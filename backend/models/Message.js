// backend/models/Message.js
import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  room: { type: String, default: "global", index: true },
  userId: { type: String, default: null },
  userName: { type: String, default: "Anonymous" },
  text: { type: String, required: true },
  clientMessageId: { type: String, default: null, index: true },
}, { timestamps: { createdAt: "createdAt" } });

export default mongoose.model("Message", MessageSchema);
