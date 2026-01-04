// FINAL WORKING VERSION FOR NODE 22 + y-websocket + ws
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils.js";

const port = 1234;

// Create basic HTTP server
const server = createServer();

// Create WebSocket server (NEW API)
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  setupWSConnection(ws, req);
});

server.listen(port, () => {
  console.log("✅ Y-WebSocket server running on ws://localhost:" + port);
});
