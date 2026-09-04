-- Eski/karantinaya alınmış sosyal yayın hatalarını operasyonel "Hatalı" kuyruğundan ayırır.
-- Hata geçmişi kaybolmaz: önce ayrı audit tablosuna arşivlenir. Ardından yalnız artık otomatik
-- yayınlanmaması gereken satırlar insan onayına çekilip aktif hata/deneme alanları temizlenir.
-- Destan Instagram HARD BLOCK kayıtlarına dokunulmaz; onlar ayrı politika altında izlenir.

CREATE TABLE IF NOT EXISTS social_publish_failure_archive (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  villa TEXT NOT NULL,
  platform TEXT NOT NULL,
  content_type TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT,
  approval_status TEXT NOT NULL,
  publish_attempt_count INTEGER NOT NULL DEFAULT 0,
  last_publish_attempt_at TEXT,
  error_message TEXT NOT NULL,
  archived_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS social_publish_failure_archive_unique_idx
ON social_publish_failure_archive (post_id, error_message, publish_attempt_count);

INSERT OR IGNORE INTO social_publish_failure_archive (
  post_id,
  villa,
  platform,
  content_type,
  scheduled_date,
  scheduled_time,
  approval_status,
  publish_attempt_count,
  last_publish_attempt_at,
  error_message,
  archived_at
)
SELECT
  id,
  villa,
  platform,
  content_type,
  scheduled_date,
  scheduled_time,
  approval_status,
  COALESCE(publish_attempt_count, 0),
  last_publish_attempt_at,
  last_publish_error,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM social_posts
WHERE status = 'Planlandı'
  AND last_publish_error IS NOT NULL
  AND NOT (villa = 'Destan' AND platform = 'Instagram')
  AND (
    approval_status = 'İnsan onayı'
    OR COALESCE(publish_attempt_count, 0) >= 3
  );

-- Karantinadaki/geçmiş retry limiti dolmuş kayıtlar artık aktif hata değildir.
-- İnsan yeniden onay verirse temiz bir deneme sayacıyla tekrar değerlendirilebilir.
UPDATE social_posts
SET approval_status = 'İnsan onayı',
    approved_at = NULL,
    publish_attempt_count = 0,
    last_publish_attempt_at = NULL,
    last_publish_error = NULL,
    publish_lock_token = NULL,
    publish_lock_expires_at = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE status = 'Planlandı'
  AND last_publish_error IS NOT NULL
  AND NOT (villa = 'Destan' AND platform = 'Instagram')
  AND (
    approval_status = 'İnsan onayı'
    OR COALESCE(publish_attempt_count, 0) >= 3
  );
