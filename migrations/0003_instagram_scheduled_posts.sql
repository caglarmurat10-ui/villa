CREATE TABLE IF NOT EXISTS instagram_scheduled_posts (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  type TEXT NOT NULL CHECK (type IN ('IMAGE', 'CAROUSEL', 'REELS')),
  caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 2200),
  media_urls TEXT NOT NULL,
  share_to_feed INTEGER NOT NULL DEFAULT 1 CHECK (share_to_feed IN (0, 1)),
  scheduled_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'processing', 'published', 'failed', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  instagram_media_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  locked_at TEXT,
  media_count INTEGER NOT NULL CHECK (media_count BETWEEN 1 AND 10),
  next_attempt_at TEXT,
  publish_started_at TEXT
);

CREATE INDEX IF NOT EXISTS instagram_scheduled_due_idx
  ON instagram_scheduled_posts (status, next_attempt_at, scheduled_at);

CREATE INDEX IF NOT EXISTS instagram_scheduled_locked_idx
  ON instagram_scheduled_posts (status, locked_at);

CREATE TABLE IF NOT EXISTS instagram_publish_log_sources (
  log_id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('manual', 'scheduled')),
  FOREIGN KEY (log_id) REFERENCES instagram_publish_log(id) ON DELETE CASCADE
);
