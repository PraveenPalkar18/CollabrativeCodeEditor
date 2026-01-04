// backend/server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import cookieParser from "cookie-parser";
import crypto from "crypto";

import Message from "./models/Message.js";
import Session from "./models/Session.js";

dotenv.config();

// ----------------- config -----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO = process.env.MONGO || "mongodb://127.0.0.1:27017/codecollab";
const PORT = Number(process.env.PORT || 5002);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const ROOM_TOKEN_SECRET = process.env.ROOM_TOKEN_SECRET || SESSION_SECRET || "room-secret";
const ROOM_TOKEN_TTL = Number(process.env.ROOM_TOKEN_TTL || 300); // seconds

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_CALLBACK = process.env.GOOGLE_CALLBACK || `http://localhost:${PORT}/auth/google/callback`;

// ----------------- app init -----------------
const app = express();

// public (oauth-close etc)
app.use(express.static(path.join(__dirname, "public")));

// CORS + JSON + cookies
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// sessions
app.use(
  session({
    name: "collab.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, { id: user.id, displayName: user.displayName, emails: user.emails || [] }));
passport.deserializeUser((obj, done) => done(null, obj));

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK,
      },
      (accessToken, refreshToken, profile, cb) => {
        const user = { id: profile.id, displayName: profile.displayName, emails: profile.emails, provider: profile.provider };
        return cb(null, user);
      }
    )
  );
} else {
  console.warn("[auth] Google OAuth keys not set - /auth/google will be disabled until configured.");
}

// ----------------- mongoose -----------------
mongoose.set("strictQuery", false);
mongoose
  .connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ----------------- helpers -----------------
function makeSlug(name = "") {
  const base = (name || "session").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base || "s"}-${suffix}`;
}
function normalizeUserEmail(user) {
  if (!user) return "";
  if (user.email) return String(user.email).toLowerCase();
  if (user.emails && user.emails[0] && user.emails[0].value) return String(user.emails[0].value).toLowerCase();
  return "";
}
function isValidObjectId(id) {
  if (!id || typeof id !== "string") return false;
  return mongoose.Types.ObjectId.isValid(id);
}
function verifyRoomToken(token) {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, ROOM_TOKEN_SECRET);
    if (!decoded || !decoded.room || !decoded.userId) return null;
    return decoded;
  } catch (e) {
    return null;
  }
}

// ----------------- auth routes -----------------
app.get("/auth/google", (req, res, next) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.status(500).send("Google OAuth not configured on server.");
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: `${FRONTEND_ORIGIN}/?auth_error=1` }),
  (req, res) => res.redirect("/auth/close")
);

app.get("/auth/me", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const u = req.user || {};
    const user = { id: u.id, name: u.displayName || u.name || "", email: normalizeUserEmail(u) };
    return res.json({ ok: true, user });
  }
  return res.json({ ok: false, user: null });
});

// ROOM TOKEN endpoint (supports session:<id> OR session:<slug>)
app.get("/auth/room-token", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ ok: false, error: "not_authenticated" });

    let room = (req.query.room && String(req.query.room)) || "global";
    console.log(`[auth] room-token requested for room='${room}' by user='${normalizeUserEmail(req.user)}'`);

    const userEmail = normalizeUserEmail(req.user);
    const userId = req.user.id || req.user.displayName || String(req.sessionID || uuidv4());
    let role = "editor";

    if (room.startsWith("session:")) {
      const sessionIdOrSlug = room.replace(/^session:/, "").trim();
      if (!sessionIdOrSlug) return res.status(400).json({ ok: false, error: "invalid_session_id" });

      let sessionDoc = null;
      if (isValidObjectId(sessionIdOrSlug)) sessionDoc = await Session.findById(sessionIdOrSlug).lean();
      else sessionDoc = await Session.findOne({ slug: sessionIdOrSlug }).lean();

      if (!sessionDoc) {
        console.warn("[auth] room-token: session not found:", sessionIdOrSlug);
        return res.status(404).json({ ok: false, error: "session_not_found" });
      }

      const ownerEmail = sessionDoc.owner?.email ? String(sessionDoc.owner.email).toLowerCase() : "";
      if (ownerEmail === userEmail) role = "owner";
      else {
        const invite = (sessionDoc.invites || []).find((i) => i.email === userEmail);
        if (!invite) return res.status(403).json({ ok: false, error: "not_invited" });
        role = invite.role || "editor";
      }

      // canonicalize room to session:<ObjectId>
      room = `session:${sessionDoc._id.toString()}`;
    }

    const payload = { room, userId, email: userEmail, role };
    const token = jwt.sign(payload, ROOM_TOKEN_SECRET, { expiresIn: `${ROOM_TOKEN_TTL}s` });
    return res.json({ ok: true, token, room });
  } catch (e) {
    console.error("room-token err", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.post("/auth/logout", (req, res) => {
  try {
    if (typeof req.logout === "function") req.logout(() => { });
    else if (req.logout) req.logout();
    if (req.session) req.session.destroy(() => { });
    res.clearCookie("collab.sid");
  } catch (e) { }
  return res.json({ ok: true });
});

app.get("/auth/close", (req, res) => res.sendFile(path.join(__dirname, "public", "oauth-close.html")));

// ----------------- Sessions API -----------------
app.post("/api/sessions", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ ok: false, error: "not_authenticated" });

    const { name, invites = [] } = req.body || {};
    if (!name || typeof name !== "string") return res.status(400).json({ ok: false, error: "invalid_name" });

    const slug = makeSlug(name);
    const owner = {
      id: req.user.id || String(req.user.displayName || req.sessionID || uuidv4()),
      email: normalizeUserEmail(req.user),
      name: req.user.displayName || req.user.name || "Owner",
    };

    const inviteRecords = Array.isArray(invites)
      ? invites.map((it) => ({ email: String(it.email || "").toLowerCase().trim(), role: it.role || "editor" }))
      : [];

    const existingOwnerIndex = inviteRecords.findIndex((i) => i.email === (owner.email || "").toLowerCase());
    if (existingOwnerIndex === -1 && owner.email) inviteRecords.unshift({ email: owner.email.toLowerCase(), role: "owner" });
    else if (existingOwnerIndex >= 0) inviteRecords[existingOwnerIndex].role = "owner";

    const sessionDoc = new Session({ name, slug, owner, invites: inviteRecords });
    await sessionDoc.save();
    return res.json({ ok: true, session: sessionDoc });
  } catch (e) {
    console.error("create session err", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.get("/api/sessions", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ ok: false, error: "not_authenticated" });
    const email = normalizeUserEmail(req.user);
    const sessions = await Session.find({ $or: [{ "owner.email": email }, { "invites.email": email }] }).sort({ updatedAt: -1 }).lean();
    return res.json({ ok: true, sessions });
  } catch (e) {
    console.error("list sessions err", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.get("/api/sessions/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let sessionDoc = null;
    if (isValidObjectId(id)) sessionDoc = await Session.findById(id).lean();
    else sessionDoc = await Session.findOne({ slug: id }).lean();
    if (!sessionDoc) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, session: sessionDoc });
  } catch (e) {
    console.error("get session err", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// ---------- INVITE: adds invite AND notifies connected invited users ----------
app.post("/api/sessions/:id/invite", async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ ok: false, error: "not_authenticated" });

    const id = req.params.id;
    const { email: rawEmail, role = "editor" } = req.body || {};
    if (!rawEmail || typeof rawEmail !== "string") return res.status(400).json({ ok: false, error: "invalid_email" });

    const email = String(rawEmail).toLowerCase().trim();
    if (!email) return res.status(400).json({ ok: false, error: "invalid_email" });

    // find session (by id or slug)
    let sessionDoc = null;
    if (isValidObjectId(id)) sessionDoc = await Session.findById(id);
    else sessionDoc = await Session.findOne({ slug: id });

    if (!sessionDoc) return res.status(404).json({ ok: false, error: "not_found" });

    const requesterEmail = normalizeUserEmail(req.user);
    if (String(sessionDoc.owner.email || "").toLowerCase().trim() !== requesterEmail) {
      return res.status(403).json({ ok: false, error: "not_owner" });
    }

    const existing = sessionDoc.invites.find((i) => i.email === email);
    if (existing) existing.role = role;
    else sessionDoc.invites.push({ email, role });

    sessionDoc.updatedAt = new Date();
    await sessionDoc.save();

    // REALTIME NOTIFY: if invited user has active socket(s)
    try {
      // NOTE: inviteNotifyMap is defined below and kept up-to-date on socket identify/disconnect
      const sockets = inviteNotifyMap.get(email) || new Set();
      if (sockets.size > 0) {
        for (const sid of sockets) {
          try {
            io.to(sid).emit("session_invite", { session: sessionDoc });
          } catch (e) {
            // ignore per-socket errors
          }
        }
      }
    } catch (e) {
      console.warn("notify invited sockets failed:", e);
    }

    return res.json({ ok: true, session: sessionDoc });
  } catch (e) {
    console.error("invite err", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

// ----------------- other APIs -----------------
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/messages/:room", async (req, res) => {
  try {
    const room = req.params.room || "global";
    const messages = await Message.find({ room }).sort({ createdAt: 1 }).limit(1000).exec();
    res.json(messages);
  } catch (err) {
    console.error("api/messages error:", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ----------------- socket.io -----------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// map email -> Set(socketId)
const inviteNotifyMap = new Map();

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // allow a client to 'identify' itself with email (after connecting)
  socket.on("identify", (payload = {}) => {
    try {
      const email = (payload.email || "").toLowerCase().trim();
      if (!email) return;
      socket.data.userEmail = email;

      let set = inviteNotifyMap.get(email);
      if (!set) {
        set = new Set();
        inviteNotifyMap.set(email, set);
      }
      set.add(socket.id);
      // optional: attach reverse mapping on socket for quick cleanup
      socket.data._inviteKey = email;
      console.log(`[socket] identified ${socket.id} -> ${email}`);
    } catch (e) { }
  });

  // legacy join_room
  socket.on("join_room", async ({ room = "global", user }) => {
    try {
      socket.join(room);
      socket.data.user = user || { id: socket.id, name: "Anonymous" };
      console.log(`➡️ ${socket.id} joined ${room}`);
      io.to(room).emit("users_update", { room, count: (io.sockets.adapter.rooms.get(room) || new Set()).size });

      try {
        const messages = await Message.find({ room }).sort({ createdAt: 1 }).limit(1000).exec();
        socket.emit("history", messages);
      } catch (e) {
        console.warn("history load err:", e);
      }
    } catch (e) {
      console.error("join_room error:", e);
    }
  });

  // join with token
  socket.on("join_room_with_token", (payload, ack = () => { }) => {
    try {
      const { token, room: requestedRoom } = payload || {};
      const info = verifyRoomToken(token);
      if (!info) return ack({ ok: false, error: "invalid_token" });

      const room = requestedRoom || info.room;
      socket.join(room);
      socket.data.user = { id: info.userId, name: info.email || "Anonymous", role: info.role || "editor" };

      console.log(`➡️ ${socket.id} joined ${room} with token user=${info.userId} role=${info.role}`);
      io.to(room).emit("users_update", { room, count: (io.sockets.adapter.rooms.get(room) || new Set()).size });

      Message.find({ room })
        .sort({ createdAt: 1 })
        .limit(1000)
        .then((messages) => socket.emit("history", messages))
        .catch((e) => console.warn("history load err:", e));

      return ack({ ok: true, user: socket.data.user });
    } catch (e) {
      console.error("join_room_with_token error:", e);
      return ack({ ok: false, error: "server_error" });
    }
  });

  socket.on("send_message", async (payload, ack = () => { }) => {
    try {
      const { room = "global", messageId, user = {}, text } = payload || {};
      if (!text || text.trim() === "") return ack({ ok: false, error: "empty" });

      const saved = new Message({
        room,
        userId: user.id || socket.id,
        userName: user.name || "Anonymous",
        text,
        clientMessageId: messageId || uuidv4(),
      });

      const doc = await saved.save();
      io.to(room).emit("receive_message", doc);
      ack({ ok: true, message: doc });
    } catch (err) {
      console.error("send_message err:", err);
      ack({ ok: false, error: "server_error" });
    }
  });

  // START MEET
  socket.on("meet_start", (payload) => {
    try {
      const { room, user, link } = payload;
      if (!room || !link) return;
      // broadcast to everyone in room (including sender if they want popup, 
      // but usually sender opens it directly. We'll broadcast to all for consistency)
      io.to(room).emit("meet_signal", { room, user, link, timestamp: Date.now() });
      console.log(`[socket] meet_start in ${room} by ${user?.name}`);
    } catch (e) {
      console.error("meet_start error:", e);
    }
  });

  socket.on("disconnect", () => {
    // cleanup inviteNotifyMap
    try {
      const email = socket.data && socket.data._inviteKey;
      if (email) {
        const set = inviteNotifyMap.get(email);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) inviteNotifyMap.delete(email);
        }
      }
    } catch (e) { }
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// ----------------- errors & start -----------------
process.on("unhandledRejection", (reason, p) => console.warn("Unhandled Rejection at: Promise", p, "reason:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught Exception thrown:", err));

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`[auth] Google callback URL: ${GOOGLE_CALLBACK}`);
});
