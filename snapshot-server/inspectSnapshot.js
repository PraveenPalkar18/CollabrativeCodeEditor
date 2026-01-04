// inspectSnapshot.js
// Usage:
//   node inspectSnapshot.js "session:6936952e4b7e0262f0fe2e6d" "./snapshots"
//   node inspectSnapshot.js "global" "./snapshots"

const fs = require("fs");
const path = require("path");
const Y = require("yjs");

const room = process.argv[2] || "global";
const snapshotsDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.resolve("./snapshots");

const filename = encodeURIComponent(room) + ".bin";
const filePath = path.join(snapshotsDir, filename);

console.log("Reading snapshot:", filePath);

if (!fs.existsSync(filePath)) {
  console.error("❌ Snapshot file not found");
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
console.log("📦 Snapshot size:", buffer.length, "bytes");

try {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(buffer));

  const files = doc.getMap("files");

  if (!files || files.size === 0) {
    console.log("⚠️ No files found inside snapshot");
    process.exit(0);
  }

  console.log("\n📁 Files in snapshot:");
  for (const [name, ytext] of files.entries()) {
    const text = ytext.toString();
    console.log(` - ${name} (length: ${text.length})`);
    console.log("   Preview:", text.slice(0, 120).replace(/\n/g, "\\n"));
  }
} catch (err) {
  console.error("❌ Failed to decode snapshot:", err);
}
