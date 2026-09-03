CREATE TABLE IF NOT EXISTS local_event_candidates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL,
  event_date_end TEXT,
  venue TEXT NOT NULL DEFAULT '',
  fee_info TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'published')),
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS local_event_candidates_status_idx ON local_event_candidates (status, event_date);
CREATE INDEX IF NOT EXISTS local_event_candidates_date_idx ON local_event_candidates (event_date);
