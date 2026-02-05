const express = require("express");
const { db, all, run, get } = require("./db");
const { authRequired } = require("./auth");

const router = express.Router();

function ownerOnly(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "owner") return res.status(403).json({ error: "Forbidden" });
  next();
}

// ✅ список пользователей (owner-only)
router.get("/api/users", authRequired, ownerOnly, async (req, res) => {
  try {
    const rows = await all(
      db,
      `SELECT id, email, full_name, role, can_invite, created_at
       FROM users
       ORDER BY id DESC
       LIMIT 200`
    );
    res.json({ ok: true, rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

// ✅ включить/выключить право приглашать (owner-only)
router.patch("/api/users/:id/can-invite", authRequired, ownerOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const can_invite = req.body?.can_invite ? 1 : 0;

    const u = await get(db, "SELECT role FROM users WHERE id = ?", [id]);
    if (!u) return res.status(404).json({ error: "User not found" });

    // нельзя “отключить” owner
    if (u.role === "owner") {
      return res.status(400).json({ error: "Owner always can invite" });
    }

    await run(db, "UPDATE users SET can_invite = ? WHERE id = ?", [can_invite, id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
