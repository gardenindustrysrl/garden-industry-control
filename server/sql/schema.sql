PRAGMA foreign_keys = ON;

-- =========================
-- USERS
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'worker', -- owner / manager / worker
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =========================
-- PROJECTS
-- =========================
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================
-- SERVICE LOGS
-- =========================
CREATE TABLE IF NOT EXISTS service_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  user_id INTEGER,
  object_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  notes TEXT,
  photo_base64 TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =========================
-- INVITES (одноразовые, через token_hash)
-- =========================
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'worker',
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (used_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_invites_token_hash ON invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON invites(expires_at);
-- =========================
-- SEED OWNER (dev)
-- создаём первого владельца, если users пустая
-- пароль потом поменяем через UI
-- =========================
INSERT INTO users (email, password_hash, full_name, role)
SELECT 'owner@gic.local', '$2a$10$0bRzCzJm2qk7H7w8p8m9yOe2Vwq0mZt7YVxw9o1KxU8n6fPpQy8vS', 'Owner', 'owner'
WHERE NOT EXISTS (SELECT 1 FROM users);
