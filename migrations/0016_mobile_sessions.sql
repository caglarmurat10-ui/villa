-- Mobil uygulama (Android/iOS) için ayrı, opaque bearer-token oturum tablosu. Web'in cookie tabanlı
-- __Host-villa_admin_session'ından TAMAMEN bağımsız - aynı ADMIN_PASSWORD credential'ını doğrular
-- ama kendi token/expiry/revoke yaşam döngüsüne sahiptir. Yalnız token'ın SHA-256 hash'i saklanır,
-- ham token hiçbir zaman D1'e yazılmaz (web session imzalama modeliyle aynı temkinli yaklaşım).
CREATE TABLE IF NOT EXISTS mobile_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  credential_version INTEGER NOT NULL,
  device_label TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS mobile_sessions_token_idx ON mobile_sessions (token_hash);
CREATE INDEX IF NOT EXISTS mobile_sessions_expiry_idx ON mobile_sessions (expires_at, revoked_at);
