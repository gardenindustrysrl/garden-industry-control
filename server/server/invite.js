const crypto = require("crypto");
const express = require("express");
const { db, run, get, all } = require("./db");
const { authRequired } = require("./auth");

const router = express.Router();

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function ownerRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "owner") return res.status(403).json({ error: "Forbidden" });
  next();
}

/**
 * ✅ GET /api/invites/:token
 * Проверка токена для invite.html
 */
router.get("/api/invites/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ valid: false, error: "token required" });

    const token_hash = hashToken(token);

    const inv = await get(
      db,
      `SELECT email, role, expires_at, used_at
       FROM invites
       WHERE token_hash = ?`,
      [token_hash]
    );

    if (!inv) return res.status(404).json({ valid: false, error: "Invite not found" });
    if (inv.used_at) return res.status(410).json({ valid: false, error: "Invite already used" });

    const stillValid = await get(
      db,
      `SELECT 1 as ok
       FROM invites
       WHERE token_hash = ?
         AND used_at IS NULL
         AND datetime(expires_at) > datetime('now')`,
      [token_hash]
    );

    if (!stillValid) return res.status(410).json({ valid: false, error: "Invite expired" });

    res.json({
      valid: true,
      email: inv.email || null,
      role: inv.role || "worker",
      expires_at: inv.expires_at,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ valid: false, error: "server error" });
  }
});

/**
 * ✅ POST /api/invites (только owner)
 * body: { email?: string, role?: "worker"|"manager", days?: number }
 */
router.post("/api/invites", authRequired, ownerRequired, async (req, res) => {
  try {
    const email = (req.body?.email ? String(req.body.email).trim() : "") || null;
    const role = (req.body?.role ? String(req.body.role).trim() : "worker") || "worker";
    const days = Number(req.body?.days ?? 7);

    const token = crypto.randomUUID();
    const token_hash = hashToken(token);

    const d = new Date();
    d.setDate(d.getDate() + (Number.isFinite(days) && days > 0 ? days : 7));
    const expires_at = d.toISOString();

    await run(
      db,
      `INSERT INTO invites (token_hash, email, role, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [token_hash, email, role, req.user.id, expires_at]
    );

    res.json({
      ok: true,
      token, // показываем один раз
      link: `/invite/${token}`,
      role,
      expires_at,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Failed to create invite" });
  }
});

/**
 * ✅ GET /api/invites-list (только owner)
 */
router.get("/api/invites-list", authRequired, ownerRequired, async (req, res) => {
  try {
    const rows = await all(
      db,
      `SELECT id, email, role, created_at, expires_at, used_at, used_by, created_by
       FROM invites
       ORDER BY id DESC
       LIMIT 200`
    );
    res.json({ ok: true, rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Failed" });
  }
});

/**
 * ⚠️ DEV ONLY: создать инвайт без авторизации (для теста)
 * УДАЛИМ после того как сделаем UI директора
 */
router.get("/api/dev/create-invite", async (req, res) => {
  try {
    const role = String(req.query.role || "worker");
    const days = Number(req.query.days || 7);
    const email = req.query.email ? String(req.query.email).trim() : null;

    const token = crypto.randomUUID();
    const token_hash = hashToken(token);

    const d = new Date();
    d.setDate(d.getDate() + (Number.isFinite(days) && days > 0 ? days : 7));
    const expires_at = d.toISOString();

    await run(
      db,
      `INSERT INTO invites (token_hash, email, role, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [token_hash, email, role, 1, expires_at]
    );

    res.json({
      ok: true,
      token,
      link: `http://127.0.0.1:3000/invite/${token}`,
      role,
      expires_at,
    });
  } catch (e) {
    console.error("❌ DEV INVITE ERROR:", e);
    res.status(500).json({ ok: false, error: "dev create invite failed", details: String(e.message || e) });
  }
});

module.exports = router;
