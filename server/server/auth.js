const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { db, get, run } = require("./db");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// ✅ Всегда поднимаем актуального пользователя из БД (role, full_name, can_invite, can_manage_structure)
async function authRequired(req, res, next) {
  const token =
    req.cookies?.token ||
    (req.headers.authorization || "").replace("Bearer ", "");

  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ error: "Invalid token" });

    const user = await get(
      db,
      `SELECT id, email, full_name, role, can_invite, can_manage_structure
       FROM users
       WHERE id = ?`,
      [decoded.id]
    );

    if (!user) return res.status(401).json({ error: "User not found" });

    const normalized = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,

      // owner всегда может приглашать
      can_invite: user.role === "owner" ? 1 : (user.can_invite ? 1 : 0),

      // owner всегда управляет структурой
      can_manage_structure:
        user.role === "owner" ? 1 : (user.can_manage_structure ? 1 : 0),
    };

    req.user = normalized;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// (обычная регистрация у тебя закрыта на сервере — оставляем функцию рабочей)
async function register(req, res) {
  const { email, password, full_name } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "email and password required" });

  const existing = await get(db, "SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return res.status(409).json({ error: "User already exists" });

  const password_hash = await bcrypt.hash(password, 10);
  const r = await run(
    db,
    "INSERT INTO users (email, password_hash, full_name, role, can_invite, can_manage_structure) VALUES (?, ?, ?, 'owner', 1, 1)",
    [email, password_hash, full_name || null]
  );

  const token = signToken({ id: r.lastID });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });

  res.json({ ok: true });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "email and password required" });

  const user = await get(db, "SELECT * FROM users WHERE email = ?", [email]);
  if (!user) return res.status(401).json({ error: "Wrong email or password" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Wrong email or password" });

  const token = signToken({ id: user.id });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });

  res.json({ ok: true });
}

// ✅ Возвращаем актуального пользователя (после authRequired)
async function me(req, res) {
  res.json({ ok: true, user: req.user });
}

function logout(req, res) {
  res.clearCookie("token");
  res.json({ ok: true });
}

module.exports = { authRequired, register, login, me, logout };
