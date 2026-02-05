require("dotenv").config();
console.log("🚀 SERVER FILE:", __filename);

const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");

const { db, run, all, dbPath } = require("./db");
const { authRequired, login, me, logout } = require("./auth");

// ✅ роутеры
const invitesRouter = require("./invite");
const registerInviteRouter = require("./registerInvite");
const usersRouter = require("./users"); // ✅ owner управляет can_invite
const structureRouter = require("./structure"); // ✅ НОВОЕ: структура (отделы/должности/сотрудники)

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Корень проекта: gic-portal (там index.html/app.js/style.css/invite.html)
const PROJECT_ROOT = path.join(__dirname, "..", "..");

// schema.sql лежит: gic-portal/server/sql/schema.sql
const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");

// ✅ Инициализация БД и схемы (с логами и проверками)
function initDb() {
  console.log("[DB] path:", dbPath);

  let schemaSql = "";
  try {
    schemaSql = fs.readFileSync(schemaPath, "utf8");
  } catch (e) {
    console.error("❌ Cannot read schema.sql:", e.message);
    console.error("   schemaPath:", schemaPath);
    process.exit(1);
  }

  // ✅ foreign keys включаем ДО выполнения схемы
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(schemaSql, (err) => {
    if (err) {
      console.error("❌ DB schema init error:", err.message);
      console.error("   schemaPath:", schemaPath);
      process.exit(1);
      return;
    }

    // ✅ ПРОВЕРКА: структура invites должна быть с token_hash
    db.all("PRAGMA table_info(invites);", (e2, cols) => {
      if (e2) {
        console.error("❌ Failed to read invites schema:", e2.message);
        process.exit(1);
        return;
      }

      const names = (cols || []).map((c) => c.name);
      const hasTokenHash = names.includes("token_hash");
      const hasExpiresAt = names.includes("expires_at");
      const hasUsedAt = names.includes("used_at");

      if (!hasTokenHash || !hasExpiresAt || !hasUsedAt) {
        console.error("❌ INVITES TABLE WRONG STRUCTURE!");
        console.error("   Expected columns: token_hash, expires_at, used_at");
        console.error("   Actual columns:", names);
        console.error("👉 Fix: use ONLY ONE invites table in schema.sql (token_hash version).");
        console.error("👉 Then delete server/data/app.db and restart.");
        process.exit(1);
        return;
      }

      console.log("✅ DB schema loaded");
      console.log("✅ invites schema OK:", names);
    });
  });
}

initDb();

// ✅ подключаем роуты
app.use(invitesRouter);
app.use(registerInviteRouter);
app.use(usersRouter);
app.use(structureRouter); // ✅ НОВОЕ

// ✅ закрываем обычную регистрацию (только invite)
app.post("/api/auth/register", (req, res) => {
  return res.status(403).json({
    error: "Registration is invite-only. Use /invite link.",
  });
});

// auth
app.post("/api/auth/login", (req, res) =>
  login(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: "server error" });
  })
);

app.get("/api/auth/me", authRequired, (req, res) => me(req, res));
app.get("/api/me", authRequired, (req, res) => me(req, res)); // ✅ алиас (удобно фронту)
app.post("/api/auth/logout", (req, res) => logout(req, res));

// --- service-log ---
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
