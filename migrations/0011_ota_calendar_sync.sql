CREATE TABLE IF NOT EXISTS external_blocks (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  source TEXT NOT NULL CHECK (source IN ('airbnb', 'booking', 'manual')),
  external_uid TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'needs_review', 'removed')),
  last_synced_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (villa, source, external_uid)
);
CREATE INDEX IF NOT EXISTS external_blocks_dates_idx ON external_blocks (villa, start_date, end_date);
CREATE INDEX IF NOT EXISTS external_blocks_status_idx ON external_blocks (villa, status);

CREATE TABLE IF NOT EXISTS ota_connections (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  platform TEXT NOT NULL CHECK (platform IN ('airbnb', 'booking')),
  listing_url TEXT NOT NULL DEFAULT '',
  is_enabled INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (villa, platform)
);
