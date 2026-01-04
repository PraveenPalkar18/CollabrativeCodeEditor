// backend/models/Room.js
import mongoose from "mongoose";

const MemberSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // store OAuth provider id or session id
  name: { type: String },
  role: {
    type: String,
    enum: ["owner", "editor", "viewer"],
    default: "viewer",
  },
  addedAt: { type: Date, default: Date.now },
});

const RoomSchema = new mongoose.Schema({
  name: { type: String, default: "Untitled Room" },
  ownerId: { type: String, required: false },
  members: { type: [MemberSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

// helper: find role for a user
RoomSchema.methods.getRoleForUser = function (userId) {
  if (!userId) return "viewer";
  if (this.ownerId && String(this.ownerId) === String(userId)) return "owner";
  const m = (this.members || []).find((mm) => String(mm.userId) === String(userId));
  return m ? m.role : "viewer";
};

export default mongoose.models.Room || mongoose.model("Room", RoomSchema);
