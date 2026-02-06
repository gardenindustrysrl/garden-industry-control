// server/invite.js  (BACKEND)
const crypto = require("crypto");
const express = require("express");
const { db, run, get, all } = require("./db");
const { authRequired } = require("./auth");

const router = express.Router();

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Кто может создавать инвайты:
 * - owner (ты)
 * - admin (пользователь, которому ты дашь право приглашать)
 *
 * ВАЖНО: это не меняет роли приглашённого (worker/manager)
 */
function canInviteRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const r = String(req.user.role || "").toLowerCase();
  if (!["owner", "admin"].includes(r)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// разрешённые роли для invite (роль будущего пользователя)
const ALLOWED_ROLES = new Set(["worker", "manager"]);

/**
 * ✅ GET /api/invites/:token
 * Проверка токена для invite.html?token=...
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
 * ✅ POST /api/invites (owner/admin)
 * body: { email?: string|null, role?: "worker"|"manager", ttl_hours?: number }
 *
 * ВАЖНО: соответствует твоему app.js (ttl_hours и inviteLink)
 */
router.post("/api/invites", authRequired, canInviteRequired, async (req, res) => {
  try {
    const emailRaw = req.body?.email ? String(req.body.email).trim() : "";
    const email = emailRaw ? emailRaw : null;

    const roleRaw = req.body?.role ? String(req.body.role).trim() : "worker";
    const role = ALLOWED_ROLES.has(roleRaw) ? roleRaw : "worker";

    const ttl_hours = Number(req.body?.ttl_hours ?? 72);
    const ttl = Number.isFinite(ttl_hours) && ttl_hours > 0 ? ttl_hours : 72;

    // UUID удобен, но оставим совместимо: randomUUID есть в Node 16+
    const token = crypto.randomUUID();
    const token_hash = hashToken(token);

    const d = new Date();
    d.setHours(d.getHours() + ttl);
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
      // правильная ссылка под invite.html, чтобы оно само дергало /api/invites/:token
      inviteLink: `/invite.html?token=${token}`,
      role,
      expires_at,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Failed to create invite" });
  }
});

/**
 * ✅ GET /api/invites-list (owner/admin)
 */
router.get("/api/invites-list", authRequired, canInviteRequired, async (req, res) => {
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

module.exports = router;
