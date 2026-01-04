// simple snapshot server that saves snapshots per-room to disk
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const mkdirp = require("mkdirp");

const PORT = process.env.PORT || 4002;
const SNAPSHOT_DIR = path.resolve(process.env.SNAPSHOT_DIR || "./snapshots");

mkdirp.sync(SNAPSHOT_DIR);

const app = express();
app.use(cors()); // allow all origins (for local dev). Lock in prod.
app.use(morgan("dev"));

// === Accept raw binary POST body ===
// We need raw body so use custom middleware for content-type octet-stream
app.post("/snapshot/:room", (req, res, next) => {
  if (req.headers["content-type"] !== "application/octet-stream") {
    // accept application/octet-stream only
    // but also allow others if needed
  }
  // Collect binary body
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const buf = Buffer.concat(chunks);
    const file = path.join(SNAPSHOT_DIR, encodeURIComponent(req.params.room) + ".bin");
    fs.writeFile(file, buf, (err) => {
      if (err) {
        console.error("Failed to write snapshot:", err);
        return res.status(500).json({ ok: false, error: "write_failed" });
      }
      return res.json({ ok: true, room: req.params.room, size: buf.length, file });
    });
  });
  req.on("error", (err) => {
    console.error("request error:", err);
    res.status(500).json({ ok: false, error: "request_error" });
  });
});

// === Get latest snapshot (returns binary) ===
app.get("/snapshot/:room", (req, res) => {
  const file = path.join(SNAPSHOT_DIR, encodeURIComponent(req.params.room) + ".bin");
  if (!fs.existsSync(file)) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }
  res.setHeader("Content-Type", "application/octet-stream");
  res.sendFile(file);
});

// simple health
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Snapshot server listening on http://localhost:${PORT}`);
  console.log(`Snapshots directory: ${SNAPSHOT_DIR}`);
});
