import http from "http";
import WebSocket from "ws";
import { setupWSConnection } from "y-websocket/bin/utils.js";

const server = http.createServer();
const port = 1234;

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  setupWSConnection(ws, req);
});

server.listen(port, () => {
  console.log("Y-WebSocket server running on port", port);
});
