// make sure mongoose is imported above: import mongoose from 'mongoose';
// and Session model is imported: import Session from "./models/Session.js";

import mongoose from "mongoose"; // if not already imported

// helper: validate ObjectId
function isValidObjectId(id) {
  if (!id || typeof id !== "string") return false;
  return mongoose.Types.ObjectId.isValid(id);
}

// ROOM_TOKEN endpoint (session-aware)
app.get("/auth/room-token", async (req, res) => {
  try {
    // require an authenticated session
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ ok: false, error: "not_authenticated" });
    }

    // default room
    let room = (req.query.room && String(req.query.room)) || "global";
    const rawRoom = room;
    console.log(`[auth] room-token requested for room=${rawRoom} by user=${normalizeUserEmail(req.user)}`);

    const userEmail = normalizeUserEmail(req.user);
    const userId = req.user.id || req.user.displayName || String(req.sessionID || uuidv4());
    let role = "editor";

    // support rooms like "session:<id>" or "session:slug"
    if (room.startsWith("session:")) {
      const sessionIdOrSlug = room.replace(/^session:/, "").trim();

      if (!sessionIdOrSlug) {
        return res.status(400).json({ ok: false, error: "invalid_session_id" });
      }

      let sessionDoc = null;

      // try by ObjectId first (safe)
      if (isValidObjectId(sessionIdOrSlug)) {
        sessionDoc = await Session.findById(sessionIdOrSlug).lean();
      } else {
        // fallback: try find by slug (useful if client uses slug)
        sessionDoc = await Session.findOne({ slug: sessionIdOrSlug }).lean();
      }

      if (!sessionDoc) {
        console.warn("[auth] room-token: session not found:", sessionIdOrSlug);
        return res.status(404).json({ ok: false, error: "session_not_found" });
      }

      // check owner/invite
      const ownerEmail = (sessionDoc.owner && sessionDoc.owner.email) ? String(sessionDoc.owner.email).toLowerCase() : "";
      if (ownerEmail === userEmail) {
        role = "owner";
      } else {
        const invite = (sessionDoc.invites || []).find((i) => i.email === userEmail);
        if (!invite) {
          // not invited -> reject
          return res.status(403).json({ ok: false, error: "not_invited" });
        }
        role = invite.role || "editor";
      }

      // canonicalize room to session:<actualId>
      room = `session:${sessionDoc._id.toString()}`;
    }

    // now sign the token
    const payload = {
      room,
      userId,
      email: userEmail,
      role,
    };
    const token = jwt.sign(payload, ROOM_TOKEN_SECRET, { expiresIn: `${ROOM_TOKEN_TTL}s` });
    return res.json({ ok: true, token, room });
  } catch (e) {
    console.error("room-token err", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});
