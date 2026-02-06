require("dotenv").config();
console.log("🚀 SERVER FILE:", __filename);

const express = require("express");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");

const { db, run, all, dbPath } = require("./db");
const { authRequired, login, me, logout } = require("./auth");

// routers
const invitesRouter = require("./invite");
const registerInviteRouter = require("./registerInvite");
const usersRouter = require("./users");
const structureRouter = require("./structure");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(usersRouter);

// корень проекта: gic-portal (там index.html/app.js/style.css/invite.html)
const PROJECT_ROOT = path.join(__dirname, "..", "..");

// schema.sql: gic-portal/server/sql/schema.sql
const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");

function execSql(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

function tableColumns(table) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table});`, (err, rows) => {
      if (err) return reject(err);
      resolve((rows || []).map((r) => r.name));
    });
  });
}

async function migrateDb() {
  // users.can_manage_structure (если база старая)
  const cols = await tableColumns("users");
  if (!cols.includes("can_manage_structure")) {
    console.log("🛠️ MIGRATION: add users.can_manage_structure");
    await execSql(`ALTER TABLE users ADD COLUMN can_manage_structure INTEGER NOT NULL DEFAULT 0;`);
    console.log("✅ MIGRATION OK: users.can_manage_structure added");
  }

  // owner всегда: can_invite=1, can_manage_structure=1
  await execSql(`UPDATE users SET can_invite=1, can_manage_structure=1 WHERE role='owner';`);
}

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

  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(schemaSql, async (err) => {
    if (err) {
      console.error("❌ DB schema init error:", err.message);
      console.error("   schemaPath:", schemaPath);
      process.exit(1);
      return;
    }

    // проверка invites (token_hash)
    db.all("PRAGMA table_info(invites);", async (e2, cols) => {
      if (e2) {
        console.error("❌ Failed to read invites schema:", e2.message);
        process.exit(1);
        return;
      }

      const names = (cols || []).map((c) => c.name);
      const ok =
        names.includes("token_hash") &&
        names.includes("expires_at") &&
        names.includes("used_at");

      if (!ok) {
        console.error("❌ INVITES TABLE WRONG STRUCTURE!");
        console.error("Expected: token_hash, expires_at, used_at");
        console.error("Actual:", names);
        console.error("👉 Fix schema.sql and delete server/data/app.db then restart");
        process.exit(1);
        return;
      }

      try {
        await migrateDb();
      } catch (e) {
        console.error("❌ Migration failed:", e.message);
        process.exit(1);
        return;
      }

      console.log("✅ DB schema loaded");
      console.log("✅ invites schema OK:", names);
    });
  });
}

initDb();

// routes
app.use(invitesRouter);
app.use(registerInviteRouter);
app.use(usersRouter);
app.use(structureRouter);

// invite-only register закрыт
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
app.get("/api/me", authRequired, (req, res) => me(req, res));
app.post("/api/auth/logout", (req, res) => logout(req, res));

// service-log
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

// static
app.use(express.static(PROJECT_ROOT));

app.get("/invite/:token", (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, "invite.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, "index.html"));
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`✅ Portal server running: http://127.0.0.1:${PORT}`);
});
