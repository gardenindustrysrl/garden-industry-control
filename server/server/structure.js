const express = require("express");
const { db, run, all, get } = require("./db");
const { authRequired } = require("./auth");

const router = express.Router();

function isOwner(u) {
  return !!u && u.role === "owner";
}

function canManageStructure(u) {
  return !!u && (u.role === "owner" || !!u.can_manage_structure);
}

async function isManagerOfDepartment(userId, depId) {
  if (!userId || !depId) return false;
  const row = await get(
    db,
    `SELECT id FROM departments WHERE id = ? AND manager_user_id = ?`,
    [depId, userId]
  );
  return !!row;
}

/**
 * Правило:
 * - owner / can_manage_structure: всё можно
 * - manager отдела: может создавать под-отделы ТОЛЬКО внутри своего отдела (parent_id = его отдел)
 * - manager отдела: может редактировать свой отдел (и только его), но не "перевешивать" выше
 */
async function requireStructureWrite(req, res, next) {
  const u = req.user;
  if (!u) return res.status(401).json({ error: "unauthorized" });
  if (canManageStructure(u)) return next();

  // иначе проверяем: он менеджер parent_id (для создания) или менеджер id (для update/delete)
  // конкретную проверку делаем в роуте (там есть id/parent_id)
  return next();
}

// =====================
// Departments (Tree)
// =====================
router.get("/api/structure/departments", authRequired, async (req, res) => {
  try {
    const rows = await all(
      db,
      `SELECT d.*,
              u.email AS manager_email,
              u.full_name AS manager_name
       FROM departments d
       LEFT JOIN users u ON u.id = d.manager_user_id
       ORDER BY d.id ASC`
    );
    res.json({ ok: true, departments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

router.post("/api/structure/departments", authRequired, requireStructureWrite, async (req, res) => {
  try {
    const u = req.user;
    const { name, description = null, parent_id = null, manager_user_id = null } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name_required" });

    // ✅ Права:
    // owner/can_manage_structure: любой parent_id
    // иначе: можно только если parent_id существует и пользователь manager этого parent_id
    if (!canManageStructure(u)) {
      if (!parent_id) {
        return res.status(403).json({ error: "forbidden_parent_required" });
      }
      const ok = await isManagerOfDepartment(u.id, Number(parent_id));
      if (!ok) return res.status(403).json({ error: "forbidden" });
    }

    const r = await run(
      db,
      `INSERT INTO departments (name, description, parent_id, manager_user_id)
       VALUES (?, ?, ?, ?)`,
      [String(name).trim(), description, parent_id, manager_user_id]
    );

    res.json({ ok: true, id: r.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

router.put("/api/structure/departments/:id", authRequired, requireStructureWrite, async (req, res) => {
  try {
    const u = req.user;
    const id = Number(req.params.id);
    const { name, description = null, parent_id = null, manager_user_id = null } = req.body || {};
    if (!id) return res.status(400).json({ error: "bad_id" });
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name_required" });

    if (!canManageStructure(u)) {
      const ok = await isManagerOfDepartment(u.id, id);
      if (!ok) return res.status(403).json({ error: "forbidden" });

      // менеджер отдела НЕ может менять parent_id (чтобы не ломать структуру)
      const current = await get(db, `SELECT parent_id FROM departments WHERE id=?`, [id]);
      if (!current) return res.status(404).json({ error: "not_found" });
      if ((current.parent_id || null) !== (parent_id || null)) {
        return res.status(403).json({ error: "forbidden_change_parent" });
      }
    }

    await run(
      db,
      `UPDATE departments
       SET name=?, description=?, parent_id=?, manager_user_id=?
       WHERE id=?`,
      [String(name).trim(), description, parent_id, manager_user_id, id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

router.delete("/api/structure/departments/:id", authRequired, requireStructureWrite, async (req, res) => {
  try {
    const u = req.user;
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });

    if (!canManageStructure(u)) {
      const ok = await isManagerOfDepartment(u.id, id);
      if (!ok) return res.status(403).json({ error: "forbidden" });
    }

    await run(db, `DELETE FROM departments WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// =====================
// Employees (for pickers)
// =====================
router.get("/api/structure/employees", authRequired, async (req, res) => {
  try {
    const rows = await all(
      db,
      `SELECT
          u.id, u.email, u.full_name, u.role, u.can_invite, u.can_manage_structure
       FROM users u
       ORDER BY u.id DESC`
    );
    res.json({ ok: true, employees: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
