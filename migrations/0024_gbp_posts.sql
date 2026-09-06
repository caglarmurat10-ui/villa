-- GBP (Google Business Profile) otomatik gönderi geçmişi. gbpContentLibrary
-- (src/lib/google-business-content.ts - sabit, önceden yazılmış, uydurma özellik/fiyat içermeyen
-- 24 taslak) içindeki kategorileri villa başına en-uzun-süre-paylaşılmamıştan başlayarak döngüsel
-- sırayla yayınlar (bkz. src/lib/gbp/schedule.ts). Gerçek Google API'sine POST atan tek fonksiyon
-- publishGbpLocalPost (src/lib/gbp/posts.ts) - kullanıcının açık isteğiyle artık zamanlanmış
-- cron'dan da çağrılıyor (bkz. custom-worker.mjs runGbpPostCronIfDue).
CREATE TABLE IF NOT EXISTS gbp_posts (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira','Destan')),
  category TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PUBLISHED','FAILED')),
  post_name TEXT,
  media_url TEXT,
  error TEXT,
  attempted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS gbp_posts_villa_category_idx ON gbp_posts (villa, category, attempted_at);
