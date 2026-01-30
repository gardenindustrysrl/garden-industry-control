const { db, dbPath } = require("./server/server/db");

db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;", [], (err, rows) => {
  if (err) {
    console.error("DB error:", err);
    process.exit(1);
  }
  console.log("DB:", dbPath);
  console.log("Tables:", rows.map(r => r.name));
  process.exit(0);
});
