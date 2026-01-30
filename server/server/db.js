const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

// 1) Путь к базе
const dbPath = process.env.DB_PATH
  ? path.join(process.cwd(), process.env.DB_PATH)
  : path.join(process.cwd(), "server", "data", "app.db");

// 2) Гарантируем, что папка существует
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// 3) Логируем путь (чтобы ты всегда видел, где БД)
console.log("[DB] path:", dbPath);

// 4) Открываем/создаём базу
const db = new sqlite3.Database(dbPath);

// helpers
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { db, run, get, all, dbPath };
