// backend/models/Session.js
import mongoose from "mongoose";

const InviteSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ["owner", "editor", "viewer"], default: "editor" },
});

const OwnerSchema = new mongoose.Schema({
  id: { type: String },
  email: { type: String, lowercase: true, trim: true },
  name: { type: String },
});

const SessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, index: true, unique: true },
    owner: { type: OwnerSchema, required: true },
    invites: { type: [InviteSchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Session = mongoose.model("Session", SessionSchema);
export default Session;
