// backend/models/User.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  googleId: { type: String, index: true },
  name: String,
  email: { type: String, index: true },
  picture: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models?.User || mongoose.model("User", UserSchema);
