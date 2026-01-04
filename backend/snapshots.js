// backend/snapshots.js
// Usage: node snapshots.js (or integrate into your existing server.js/express app)
const express = require("express");
const { MongoClient, Binary } = require("mongodb");
const bodyParser = require("body-parser");

const app = express();
// allow raw binary bodies
app.use(bodyParser.raw({ type: "application/octet-stream", limit: "10mb" }));

// CONFIG - set by env or fallback values
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "collabdb";
const PORT = process.env.SNAPSHOT_PORT || 4002;

let db;
let snapshots;

async function connectDB() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);
  snapshots = db.collection("snapshots");
  // ensure index for room
  await snapshots.createIndex({ room: 1 }, { unique: true });
  console.log("Connected to MongoDB", MONGO_URL, "db:", DB_NAME);
}

/**
 * Save snapshot for room
 * POST /snapshot/:room   body = binary Y.encodeStateAsUpdate(ydoc)
 */
app.post("/snapshot/:room", async (req, res) => {
  try {
    const room = req.params.room;
    const data = req.body; // Buffer from raw body
    if (!Buffer.isBuffer(data) || data.length === 0) {
      return res.status(400).json({ error: "Empty snapshot" });
    }
    const doc = {
      room,
      data: new Binary(data),
      updatedAt: new Date(),
    };
    // Upsert the latest snapshot by room
    await snapshots.updateOne({ room }, { $set: doc }, { upsert: true });
    return res.json({ ok: true, bytes: data.length });
  } catch (err) {
    console.error("snapshot save error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

/**
 * Get snapshot for room
 * GET /snapshot/:room
 * returns binary application/octet-stream (latest snapshot)
 */
app.get("/snapshot/:room", async (req, res) => {
  try {
    const room = req.params.room;
    const row = await snapshots.findOne({ room });
    if (!row || !row.data) return res.status(404).json({ error: "no snapshot" });
    const buf = Buffer.from(row.data.buffer);
    res.set("Content-Type", "application/octet-stream");
    res.set("Content-Length", buf.length);
    res.send(buf);
  } catch (err) {
    console.error("snapshot fetch error:", err);
    res.status(500).json({ error: String(err) });
  }
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Snapshot server running on http://localhost:${PORT}`);
  });
}

start().catch((e) => {
  console.error("Failed to start snapshot server", e);
  process.exit(1);
});
