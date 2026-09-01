-- Yeni staging/source-of-truth katmanı: içerik-planlama spreadsheet'lerinden (Tam Paket / 30 Gün)
-- normalize edilen içerikler burada tutulur, operasyonel social_posts tablosuna DOKUNMADAN.
-- Bir satır ancak automation_class=AUTO_SAFE olup medyası çözüldükten sonra social_posts'a
-- "promote" edilir (promoted_post_id ile iz sürülür) - format/theme/cta gibi alanlar bilerek CHECK
-- ile kısıtlanmadı, çünkü spreadsheet'in gerçek sütun kelime dağarcığı henüz görülmedi; sınıflandırma
-- yalnız BİZİM tanımladığımız automation_class/status enumlarında yapılıyor.
CREATE TABLE IF NOT EXISTS social_content_library (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  platform TEXT NOT NULL CHECK (platform IN ('Instagram', 'Facebook', 'TikTok', 'WhatsApp Durum')),
  format TEXT NOT NULL,
  theme TEXT,
  caption TEXT NOT NULL,
  cta TEXT,
  hashtags TEXT NOT NULL DEFAULT '',
  media_source TEXT,
  scheduled_at TEXT,
  automation_class TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED' CHECK (automation_class IN ('AUTO_SAFE', 'REVIEW_REQUIRED', 'BLOCKED')),
  status TEXT NOT NULL DEFAULT 'IMPORTED' CHECK (status IN ('IMPORTED', 'MATCHED', 'PROMOTED', 'SKIPPED', 'DUPLICATE')),
  source TEXT NOT NULL,
  last_verified_at TEXT,
  promoted_post_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (content_id, platform)
);

CREATE INDEX IF NOT EXISTS social_content_library_villa_idx ON social_content_library (villa, platform, status);
CREATE INDEX IF NOT EXISTS social_content_library_automation_idx ON social_content_library (automation_class, status);
