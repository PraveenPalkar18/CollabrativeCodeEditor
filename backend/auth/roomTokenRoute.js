// backend/auth/roomTokenRoute.js
import express from "express";
import jwt from "jsonwebtoken";
import Room from "../models/Room.js";

const router = express.Router();

// helper: read session user id (passport may use req.user.id or req.user._id)
function getSessionUserId(req) {
  if (!req.user) return null;
  return req.user.id || req.user._id || req.user.sub || req.user.providerId || null;
}

// GET /auth/room-token?room=<roomId>
router.get("/room-token", async (req, res) => {
  try {
    const user = req.user; // passport places user here if session exists
    const roomId = req.query.room;
    if (!user) return res.status(401).json({ error: "not_authenticated" });
    if (!roomId) return res.status(400).json({ error: "missing_room" });

    const sessionUserId = getSessionUserId(req);
    if (!sessionUserId) return res.status(401).json({ error: "invalid_session_user" });

    // find room; if not found, create minimal fallback (optional)
    const room = await Room.findById(roomId).lean();
    if (!room) return res.status(404).json({ error: "room_not_found" });

    // compute role
    let role = "viewer";
    if (room.ownerId && String(room.ownerId) === String(sessionUserId)) role = "owner";
    else {
      const member = (room.members || []).find((m) => String(m.userId) === String(sessionUserId));
      if (member && member.role) role = member.role;
    }

    const payload = {
      room: String(roomId),
      userId: String(sessionUserId),
      role,
    };

    const secret = process.env.ROOM_TOKEN_SECRET || process.env.SESSION_SECRET || "room-secret";
    const ttl = process.env.ROOM_TOKEN_TTL || "30m";

    const token = jwt.sign(payload, secret, { expiresIn: ttl });

    return res.json({ ok: true, token, payload: { room: payload.room, role, userId: payload.userId } });
  } catch (err) {
    console.error("room-token error:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
