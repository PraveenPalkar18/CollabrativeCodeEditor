// backend/middleware/authMiddleware.js
export function requireLogin(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ error: "login required" });
}

export function requireRoleInRoom(roleList = ["editor", "owner"]) {
  return async function (req, res, next) {
    // use with routes that pass room name as req.params.room
    const Room = (await import("../models/Room.js")).default;
    const user = req.user;
    if (!user) return res.status(401).json({ error: "login required" });
    const roomName = req.params.room || req.body.room;
    if (!roomName) return res.status(400).json({ error: "room missing" });
    const room = await Room.findOne({ name: roomName }).exec();
    if (!room) return res.status(404).json({ error: "room not found" });
    const entry = room.acl.find(a => a.userId.toString() === user._id.toString());
    if (!entry || !roleList.includes(entry.role)) return res.status(403).json({ error: "forbidden" });
    req.room = room;
    next();
  };
}
