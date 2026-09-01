-- NOT (2026-09-01 sonrasında eklendi, migration hygiene düzeltmesi): media_url/approval_status/
-- approved_at production'da bu dosya zaten uygulandıktan SONRA yalnızca src/lib/social-db.ts'in
-- runtime "ALTER TABLE ... ADD COLUMN" fallback'iyle eklenmişti - migrations/ klasöründe hiç
-- karşılığı yoktu. Bu, migration-only bir fresh D1 kurulumunun 0004'teki
-- "approval_status" sütununu kullanan index'te HATA VERMESİNE yol açan gerçek bir bug'dı (0004 bu
-- sütun daha var olmadan çalışıyordu). d1_migrations yalnız dosya ADINI izliyor, içerik hash'i
-- tutmuyor (doğrulandı) - bu dosya zaten uygulanmış olduğu için bu düzeltme production'a KARŞI
-- asla yeniden çalışmaz, yalnız gelecekteki fresh/yeni D1 kurulumlarını düzeltir.
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  platform TEXT NOT NULL CHECK (platform IN ('Instagram', 'Facebook', 'TikTok', 'WhatsApp Durum')),
  content_type TEXT NOT NULL CHECK (content_type IN ('Gönderi', 'Hikâye', 'Reels', 'Durum')),
  scheduled_date TEXT NOT NULL,
  caption TEXT NOT NULL CHECK (length(caption) BETWEEN 1 AND 2200),
  status TEXT NOT NULL DEFAULT 'Planlandı' CHECK (status IN ('Planlandı', 'Yayınlandı')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  media_url TEXT NOT NULL DEFAULT '',
  approval_status TEXT NOT NULL DEFAULT 'İnsan onayı' CHECK (approval_status IN ('İnsan onayı', 'Onaylandı')),
  approved_at TEXT
);

CREATE INDEX IF NOT EXISTS social_posts_schedule_idx ON social_posts (status, scheduled_date);
