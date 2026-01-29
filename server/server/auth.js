const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { get, run } = require("./db");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req, res, next) {
  const token = req.cookies?.token || (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function register(req, res) {
  const { email, password, full_name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const existing = await get(require("./db").db, "SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return res.status(409).json({ error: "User already exists" });

  const password_hash = await bcrypt.hash(password, 10);
  const r = await run(require("./db").db,
    "INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, 'owner')",
    [email, password_hash, full_name || null]
  );

  const token = signToken({ id: r.lastID, email, role: "owner" });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.json({ ok: true });
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const user = await get(require("./db").db, "SELECT * FROM users WHERE email = ?", [email]);
  if (!user) return res.status(401).json({ error: "Wrong email or password" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Wrong email or password" });

  const token = signToken({ id: user.id, email: user.email, role: user.role });
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.json({ ok: true, role: user.role, full_name: user.full_name });
}

async function me(req, res) {
  res.json({ ok: true, user: req.user });
}

function logout(req, res) {
  res.clearCookie("token");
  res.json({ ok: true });
}

module.exports = { authRequired, register, login, me, logout };
