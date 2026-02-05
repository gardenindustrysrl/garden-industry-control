const express = require("express");
const { db, run, all } = require("./db");
const { authRequired } = require("./auth");

const router = express.Router();

function requireAdmin(req, res, next) {
  // owner ИЛИ can_invite
  const u = req.user;
  if (!u) return res.status(401).json({ error: "unauthorized" });

  const isOwner = u.role === "owner";
  const canInvite = !!u.can_invite;

  if (!isOwner && !canInvite) return res.status(403).json({ error: "forbidden" });
  next();
}

// =====================
// Departments
// =====================
router.get("/api/structure/departments", authRequired, async (req, res) => {
  try {
    const rows = await all(
      db,
      `SELECT d.*,
              u.email AS manager_email
       FROM departments d
       LEFT JOIN users u ON u.id = d.manager_user_id
       ORDER BY d.name ASC`
    );
    res.json({ ok: true, departments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

router.post("/api/structure/departments", authRequired, requireAdmin, async (req, res) => {
  try {
    const { name, parent_id = null, manager_user_id = null } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name_required" });

    const r = await run(
      db,
      `INSERT INTO departments (name, parent_id, manager_user_id)
       VALUES (?, ?, ?)`,
      [String(name).trim(), parent_id, manager_user_id]
    );

    res.json({ ok: true, id: r.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

router.put("/api/structure/departments/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, parent_id = null, manager_user_id = null } = req.body || {};
    if (!id) return res.status(400).json({ error: "bad_id" });
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name_required" });

    await run(
      db,
      `UPDATE departments
       SET name=?, parent_id=?, manager_user_id=?
       WHERE id=?`,
      [String(name).trim(), parent_id, manager_user_id, id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

router.delete("/api/structure/departments/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });

    await run(db, `DELETE FROM departments WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// =====================
// Positions
// =====================
router.get("/api/structure/positions", authRequired, async (req, res) => {
  try {
    const rows = await all(
      db,
      `SELECT p.*,
              d.name AS department_name
       FROM positions p
       LEFT JOIN departments d ON d.id = p.department_id
       ORDER BY p.name ASC`
    );
    res.json({ ok: true, positions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

router.post("/api/structure/positions", authRequired, requireAdmin, async (req, res) => {
  try {
    const { name, department_id = null } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name_required" });

    const r = await run(
      db,
      `INSERT INTO positions (name, department_id)
       VALUES (?, ?)`,
      [String(name).trim(), department_id]
    );

    res.json({ ok: true, id: r.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

router.put("/api/structure/positions/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, department_id = null } = req.body || {};
    if (!id) return res.status(400).json({ error: "bad_id" });
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name_required" });

    await run(
      db,
      `UPDATE positions
       SET name=?, department_id=?
       WHERE id=?`,
      [String(name).trim(), department_id, id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

router.delete("/api/structure/positions/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });

    await run(db, `DELETE FROM positions WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// =====================
// Employees (list + assign)
// =====================
router.get("/api/structure/employees", authRequired, async (req, res) => {
  try {
    const rows = await all(
      db,
      `SELECT
          u.id, u.email, u.role, u.can_invite,
          up.first_name, up.last_name, up.phone,
          up.department_id, d.name AS department_name,
          up.position_id, p.name AS position_name,
          up.manager_user_id, mu.email AS manager_email
       FROM users u
       LEFT JOIN user_profile up ON up.user_id = u.id
       LEFT JOIN departments d ON d.id = up.department_id
       LEFT JOIN positions p ON p.id = up.position_id
       LEFT JOIN users mu ON mu.id = up.manager_user_id
       ORDER BY u.id DESC`
    );

    res.json({ ok: true, employees: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

router.put("/api/structure/employees/:id", authRequired, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ error: "bad_id" });

    const { department_id = null, position_id = null, manager_user_id = null } = req.body || {};

    await run(
      db,
      `INSERT INTO user_profile (user_id, department_id, position_id, manager_user_id, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         department_id=excluded.department_id,
         position_id=excluded.position_id,
         manager_user_id=excluded.manager_user_id,
         updated_at=datetime('now')`,
      [userId, department_id, position_id, manager_user_id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
