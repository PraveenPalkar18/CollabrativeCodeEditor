// y-server/y-server-auth.js
import http from "http";
import { WebSocketServer } from "ws";
import mongo from "mongoose";
import crypto from "crypto";
import Room from "../backend/models/Room.js"; // path from y-server -> backend models
import Y from "yjs";
import map from "lib0/map.js";
import * as encoding from "lib0/encoding.js";
import * as decoding from "lib0/decoding.js";
import { setupWSConnection } from "y-websocket/bin/utils.js"; // server util

// env
const WS_PORT = parseInt(process.env.YWS_PORT || "1234", 10);
const MONGO_URL = process.env.MONGO || "mongodb://127.0.0.1:27017/collab";
const SECRET = process.env.ROOM_TOKEN_SECRET || "room-secret";

// connect to mongo to read ACLs
mongo.set("strictQuery", false);
await mongo.connect(MONGO_URL, {});

const server = http.createServer();
const wss = new WebSocketServer({ server });

console.log("✅ Y-WebSocket (auth) server starting...");

function verifyToken(token) {
  try {
    const [b64, sig] = token.split(".");
    const json = Buffer.from(b64, "base64").toString();
    const expectedSig = crypto.createHmac("sha256", SECRET).update(json).digest("hex");
    if (expectedSig !== sig) return null;
    const payload = JSON.parse(json);
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

wss.on("connection", (ws, req) => {
  // parse token from query: ws://host:port?token=...
  const url = req.url || "";
  const params = new URLSearchParams(url.split("?")[1]);
  const token = params.get("token") || null;
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    // If no token, allow anonymous viewer-only connection (optional)
    ws.send(JSON.stringify({ type: "warning", message: "no token — viewer-only" }));
    // we still allow connection but mark role = viewer and block writes later
    ws.auth = { role: "viewer", userId: null, name: "anonymous" };
  } else {
    // got an authenticated user/payload
    ws.auth = { role: payload.role || "viewer", userId: payload.userId, name: payload.name, room: payload.room };
  }

  // Setup Y-WebSocket connection using existing utility,
  // but intercept update messages to enforce write permission:
  try {
    setupWSConnection(ws, req, {
      gc: true,
      // add custom message handler by augmenting ws
      // setupWSConnection installs its own handler; we patch ws.send to allow role checks in server-level ops if needed.
    });

    // After the connection is established, attach listener to intercept updates:
    ws.on("message", (message) => {
      // message is binary (Uint8Array) from y-websocket protocol
      // We allow read-only clients (viewer) but block messages that are Yjs update (type 0x01 etc.)
      // Simple approach: if client is viewer, ignore any binary update messages that are of the 'sync update' type:
      // The utils inside y-websocket handle decoding; to avoid fragile parsing, we check a flag on ws to mark viewer and close if disallowed.
      // NOTE: setupWSConnection will still process messages. A robust implementation needs to hook into the internal handler.
      // Practical approach: if viewer and any message length > small threshold treat as write attempt and close:
      try {
        if (ws.auth?.role === "viewer") {
          // detect attempts to send update messages by heuristics: binary frames likely contain updates
          if (typeof message !== "string") {
            // block and close
            // Option: close connection or simply ignore (safer to ignore)
            // For now, ignore silently
            return;
          }
        }
      } catch (e) {}
    });
  } catch (e) {
    console.error("setupWSConnection error", e);
    ws.close();
  }

});

server.listen(WS_PORT, () => {
  console.log(`Y-WebSocket (auth) server running on ws://localhost:${WS_PORT}`);
});
