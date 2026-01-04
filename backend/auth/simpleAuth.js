// backend/auth/simpleAuth.js
import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

// Must match session secret in .env
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour tokens (adjust)

// --- Helper: ensure session-based "login" for dev ---
// POST /auth/login { name }
router.post("/login", (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });

  // attach user to session
  req.session.user = {
    id: req.sessionID,
    name: name.trim(),
    role: "developer", // default role, change as needed
  };

  return res.json({ ok: true, user: req.session.user });
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.warn("session destroy err", err);
    }
    res.json({ ok: true });
  });
});

// GET /auth/me -> returns current session user (if any)
router.get("/me", (req, res) => {
  if (req.session && req.session.user) return res.json({ ok: true, user: req.session.user });
  return res.status(401).json({ ok: false, error: "not_logged_in" });
});

// GET /auth/room-token?room=xxx
// If user logged in (session exists), return short-lived JWT used by Y-WebSocket auth
router.get("/room-token", (req, res) => {
  const room = (req.query.room || "global-room").toString();
  const user = req.session && req.session.user;

  // You can allow anonymous tokens too if you want:
  // if (!user) return res.status(401).json({ ok: false, error: "not_logged_in" });

  // For dev, we permit anonymous tokens but include limited info:
  const payload = {
    room,
    user: user
      ? { id: user.id || req.sessionID, name: user.name, role: user.role || "developer" }
      : { anonymous: true, id: `anon-${Math.random().toString(36).slice(2, 9)}` },
  };

  const token = jwt.sign(payload, SESSION_SECRET, { expiresIn: TOKEN_TTL_SECONDS + "s" });

  return res.json({
    ok: true,
    token,
    expiresIn: TOKEN_TTL_SECONDS,
  });
});

export default router;
