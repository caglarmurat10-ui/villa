CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  guest_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  channel TEXT NOT NULL,
  nightly_rate REAL NOT NULL CHECK (nightly_rate >= 0),
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  paid_amount REAL NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  notes TEXT NOT NULL DEFAULT '',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reservations_dates_idx ON reservations (villa, check_in, check_out);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO settings (key, value) VALUES ('commission_rate', '10');
CREATE TABLE IF NOT EXISTS price_ranges (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  nightly_rate REAL NOT NULL CHECK (nightly_rate > 0),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS price_ranges_lookup_idx ON price_ranges (villa, start_date, end_date);
