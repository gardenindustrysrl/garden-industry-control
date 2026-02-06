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
  can_invite INTEGER NOT NULL DEFAULT 0, -- право приглашать (0/1)
  can_manage_structure INTEGER NOT NULL DEFAULT 0, -- ✅ право управлять структурой (0/1)
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
-- INVITES (ONE-TIME TOKENS)
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

-- =========================================================
-- ORG STRUCTURE
-- =========================================================
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  parent_id INTEGER,
  manager_user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_departments_manager ON departments(manager_user_id);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  department_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_positions_department ON positions(department_id);

CREATE TABLE IF NOT EXISTS user_profile (
  user_id INTEGER PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  photo_base64 TEXT,
  department_id INTEGER,
  position_id INTEGER,
  manager_user_id INTEGER,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL,
  FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_profile_department ON user_profile(department_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_position ON user_profile(position_id);
CREATE INDEX IF NOT EXISTS idx_user_profile_manager ON user_profile(manager_user_id);

-- =========================
-- SEED OWNER (dev)
-- admin@garden.md / 123456
-- bcrypt hash below must match 123456
-- =========================
INSERT INTO users (email, password_hash, full_name, role, can_invite, can_manage_structure)
SELECT
  'admin@garden.md',
  '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5Jr.1gGm1hD4fZrZ8q7dQkYyV8p9K',
  'Admin',
  'owner',
  1,
  1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@garden.md');
