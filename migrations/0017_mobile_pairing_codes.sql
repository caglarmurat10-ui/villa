CREATE TABLE IF NOT EXISTS mobile_pairing_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS mobile_pairing_codes_hash_idx ON mobile_pairing_codes (code_hash);
CREATE INDEX IF NOT EXISTS mobile_pairing_codes_expiry_idx ON mobile_pairing_codes (expires_at, used_at);
