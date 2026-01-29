require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");

const { db, run, all } = require("./db");
const { authRequired, login, me, logout } = require("./auth");

// ✅ инвайты (файлы лежат рядом с server.js в server/server/)
const invitesRouter = require("./invites");
const registerInviteRouter = require("./registerInvite");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Корень проекта: gic-portal (там index.html/app.js/style.css)
const PROJECT_ROOT = path.join(__dirname, "..", "..");

// schema.sql лежит: gic-portal/server/sql/schema.sql
const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf8");
db.exec(schemaSql);

// ✅ подключаем роуты инвайтов
app.use(invitesRouter);
app.use(registerInviteRouter);

// ✅ закрываем обычную регистрацию (только invite)
app.post("/api/auth/register", (req, res) => {
  return res.status(403).json({ error: "Registration is invite-only. Use /invite link." });
});

app.post("/api/auth/login", (req, res) =>
  login(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: "server error" });
  })
);

app.get("/api/auth/me", authRequired, (req, res) => me(req, res));
app.post("/api/auth/logout", (req, res) => logout(req, res));

// --- твой service-log ---
app.post("/api/service-log", authRequired, async (req, res) => {
  try {
    const { object_name, task_type, notes, photo_base64, project_id } = req.body || {};
    if (!object_name || !task_type) {
      return res.status(400).json({ error: "object_name and task_type required" });
    }

    const r = await run(
      db,
      `INSERT INTO service_logs (project_id, user_id, object_name, task_type, notes, photo_base64)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [project_id || null, req.user.id, object_name, task_type, notes || null, photo_base64 || null]
    );

    res.json({ ok: true, id: r.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

app.get("/api/service-log", authRequired, async (req, res) => {
  try {
    const rows = await all(
      db,
      `SELECT id, object_name, task_type, notes, created_at, user_id, project_id
       FROM service_logs ORDER BY id DESC LIMIT 200`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

// ✅ Статика из корня проекта
app.use(express.static(PROJECT_ROOT));

// ✅ Страница приглашения (invite.html должен быть в корне gic-portal)
app.get("/invite/:token", (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, "invite.html"));
});

// Главная
app.get("/", (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, "index.html"));
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`✅ Portal server running: http://127.0.0.1:${PORT}`);
});
