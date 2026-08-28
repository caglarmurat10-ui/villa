-- Facebook Page tokens must not live in D1.
-- The application stores only non-secret Page metadata here; encrypted tokens live in META_PRIVATE KV.
DROP TABLE IF EXISTS facebook_accounts;

CREATE TABLE IF NOT EXISTS facebook_account_metadata (
  villa TEXT PRIMARY KEY CHECK (villa IN ('Safira','Destan')),
  account_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  profile_url TEXT,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
