// backend/routes/sessionsRouter.js
import express from "express";
import crypto from "crypto";
import Session from "../models/Session.js";

const router = express.Router();

function makeSlug(name = "") {
  const base = (name || "session").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base || "s"}-${suffix}`;
}

// requireAuth middleware
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ ok: false, error: "not_authenticated" });
}

// create session
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, invites = [] } = req.body || {};
    if (!name || typeof name !== "string") return res.status(400).json({ ok: false, error: "invalid_name" });

    const slug = makeSlug(name);
    const owner = {
      id: req.user.id || String(req.user.id || req.user.displayName || req.sessionID || ""),
      email: (req.user.emails && req.user.emails[0] && req.user.emails[0].value) || req.user.email || "",
      name: req.user.displayName || req.user.name || "Owner",
    };

    const inviteRecords = Array.isArray(invites)
      ? invites.map((it) => ({ email: String(it.email || "").toLowerCase().trim(), role: it.role || "editor" }))
      : [];

    // ensure owner is present and owner role
    const ownerEmail = (owner.email || "").toLowerCase();
    const existing = inviteRecords.findIndex((i) => i.email === ownerEmail);
    if (existing === -1 && ownerEmail) inviteRecords.unshift({ email: ownerEmail, role: "owner" });
    else if (existing >= 0) inviteRecords[existing].role = "owner";

    const doc = new Session({ name, slug, owner, invites: inviteRecords });
    await doc.save();
    res.json({ ok: true, session: doc });
  } catch (e) {
    console.error("create session error:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// list sessions the user is part of
router.get("/", requireAuth, async (req, res) => {
  try {
    const email = ((req.user.emails && req.user.emails[0] && req.user.emails[0].value) || req.user.email || "").toLowerCase();
    const sessions = await Session.find({ $or: [{ "owner.email": email }, { "invites.email": email }] })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ ok: true, sessions });
  } catch (e) {
    console.error("list sessions err:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// get session by id
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const doc = await Session.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, session: doc });
  } catch (e) {
    console.error("get session err:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// invite (owner only)
router.post("/:id/invite", requireAuth, async (req, res) => {
  try {
    const { email, role = "editor" } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: "invalid_email" });

    const doc = await Session.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: "not_found" });

    const requesterEmail = ((req.user.emails && req.user.emails[0] && req.user.emails[0].value) || req.user.email || "").toLowerCase();
    if (doc.owner.email !== requesterEmail) return res.status(403).json({ ok: false, error: "not_owner" });

    const norm = String(email).toLowerCase().trim();
    const existing = doc.invites.find((i) => i.email === norm);
    if (existing) existing.role = role;
    else doc.invites.push({ email: norm, role });
    await doc.save();
    res.json({ ok: true, session: doc });
  } catch (e) {
    console.error("invite err:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
