const crypto = require("crypto");
const express = require("express");
const { db, run, get } = require("./db");
const { authRequired } = require("./auth");
const requireRole = require("./requireRole");

const router = express.Router();

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// 1) OWNER создаёт приглашение
router.post("/api/invites", authRequired, requireRole(["owner"]), async (req, res) => {
  try {
    const { email = null, role = "worker", ttl_hours = 72 } = req.body || {};

    const token = makeToken();
    const token_hash = hashToken(token);

    const hours = Number(ttl_hours) || 72;

    // expires_at считаем средствами SQLite (надёжно)
    // datetime('now', '+72 hours')
    const expiresExpr = `datetime('now', '+${hours} hours')`;

    await run(
      db,
      `INSERT INTO invites(token_hash, email, role, created_by, expires_at)
       VALUES(?, ?, ?, ?, ${expiresExpr})`,
      [token_hash, email, role, req.user.id]
    );

    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const inviteLink = `${baseUrl}/invite/${token}`;

    // вернём expires_at из БД
    const row = await get(db, `SELECT expires_at FROM invites WHERE token_hash = ?`, [token_hash]);

    res.json({ inviteLink, expires_at: row?.expires_at, role, email });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create invite", details: String(e) });
  }
});

// 2) Проверка приглашения (открытая)
router.get("/api/invites/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const token_hash = hashToken(token);

    // valid если:
    // - существует
    // - не использован
    // - не истёк
    const row = await get(
      db,
      `SELECT id, email, role, expires_at, used_at
       FROM invites
       WHERE token_hash = ?
         AND used_at IS NULL
         AND expires_at > datetime('now')`,
      [token_hash]
    );

    if (!row) {
      // уточним причину (для человека)
      const any = await get(
        db,
        `SELECT expires_at, used_at FROM invites WHERE token_hash = ?`,
        [token_hash]
      );
      if (!any) return res.status(404).json({ valid: false, error: "Invite not found" });
      if (any.used_at) return res.status(410).json({ valid: false, error: "Invite already used" });
      return res.status(410).json({ valid: false, error: "Invite expired" });
    }

    res.json({ valid: true, email: row.email, role: row.role, expires_at: row.expires_at });
  } catch (e) {
    console.error(e);
    res.status(500).json({ valid: false, error: "Failed to validate invite", details: String(e) });
  }
});

module.exports = router;
