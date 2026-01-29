const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const { db, run, get } = require("./db");

const router = express.Router();

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

router.post("/api/register-invite", async (req, res) => {
  try {
    const { token, email, password, full_name } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: "token and password required" });

    const token_hash = hashToken(token);

    // берём только валидный инвайт
    const invite = await get(
      db,
      `SELECT id, email as invite_email, role
       FROM invites
       WHERE token_hash = ?
         AND used_at IS NULL
         AND expires_at > datetime('now')`,
      [token_hash]
    );

    if (!invite) {
      // уточним причину
      const any = await get(db, `SELECT expires_at, used_at FROM invites WHERE token_hash = ?`, [token_hash]);
      if (!any) return res.status(404).json({ error: "Invite not found" });
      if (any.used_at) return res.status(410).json({ error: "Invite already used" });
      return res.status(410).json({ error: "Invite expired" });
    }

    const finalEmail = invite.invite_email || (email ? String(email).trim() : "");
    if (!finalEmail) return res.status(400).json({ error: "email required" });

    const existing = await get(db, `SELECT id FROM users WHERE email = ?`, [finalEmail]);
    if (existing) return res.status(409).json({ error: "User already exists" });

    const password_hash = await bcrypt.hash(password, 10);

    const r = await run(
      db,
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES (?, ?, ?, ?)`,
      [finalEmail, password_hash, full_name || null, invite.role || "worker"]
    );

    await run(
      db,
      `UPDATE invites
       SET used_at = datetime('now'), used_by = ?
       WHERE id = ?`,
      [r.lastID, invite.id]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to register by invite", details: String(e) });
  }
});

module.exports = router;
