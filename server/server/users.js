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
      `SELECT id, email, full_name, role, can_invite, can_manage_structure, created_at
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

// ✅ НОВОЕ: право управлять структурой (owner-only)
router.patch("/api/users/:id/can-manage-structure", authRequired, ownerOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const can_manage_structure = req.body?.can_manage_structure ? 1 : 0;

    const u = await get(db, "SELECT role FROM users WHERE id = ?", [id]);
    if (!u) return res.status(404).json({ error: "User not found" });

    if (u.role === "owner") {
      return res.status(400).json({ error: "Owner always can manage structure" });
    }

    await run(
      db,
      "UPDATE users SET can_manage_structure = ? WHERE id = ?",
      [can_manage_structure, id]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
// ✅ POST /api/users/set-can-invite  (owner only)
// body: { user_id: number, can_invite: 0|1 }
router.post("/api/users/set-can-invite", authRequired, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (req.user.role !== "owner") return res.status(403).json({ error: "Forbidden" });

    const user_id = Number(req.body?.user_id);
    const can_invite = Number(req.body?.can_invite) ? 1 : 0;

    if (!Number.isFinite(user_id) || user_id <= 0) {
      return res.status(400).json({ error: "user_id required" });
    }

    // не даём менять owner (и себя можно запретить — по желанию)
    const target = await get(db, `SELECT id, role FROM users WHERE id = ?`, [user_id]);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.role === "owner") return res.status(400).json({ error: "Cannot change owner" });

    await run(db, `UPDATE users SET can_invite = ? WHERE id = ?`, [can_invite, user_id]);

    res.json({ ok: true, user_id, can_invite });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed" });
  }
});
