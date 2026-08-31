CREATE TABLE IF NOT EXISTS admin_auth_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations >= 100000),
  credential_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
