-- Çok-platformlu içerik paketleri (bölüm 5/6) - Instagram/Facebook'un otomatik Graph API yayın
-- akışından (social_posts) BİLEREK AYRI: YouTube Shorts/TikTok/Pinterest için resmi/doğrulanmış bir
-- yayın API'si yok, bu yüzden bu tablo yalnız MANUEL yayın hazırlığını izler. platform_post_id gibi
-- bir sağlayıcı-onay alanı KASITLI OLARAK yok - bu paketler hiçbir zaman "API tarafından
-- yayınlandı" gibi görünemez, yalnız insan onayı ile manually_published_at dolar.
CREATE TABLE IF NOT EXISTS platform_content_packages (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'youtube_shorts', 'tiktok', 'pinterest')),
  source_file_id TEXT NOT NULL,
  theme TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  title TEXT,
  caption TEXT NOT NULL,
  cta TEXT NOT NULL,
  hashtags TEXT NOT NULL,
  utm_url TEXT NOT NULL,
  recommended_ratio TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video')),
  manual_publish_state TEXT NOT NULL DEFAULT 'READY_FOR_MANUAL_PUBLISH' CHECK (manual_publish_state IN ('READY_FOR_MANUAL_PUBLISH', 'MANUALLY_PUBLISHED')),
  manually_published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS platform_content_packages_villa_idx ON platform_content_packages (villa, platform, manual_publish_state);

-- Harita görünürlüğü takip/iş akışı (bölüm 10) - yalnız DURUM izleme, hiçbir dış sunuma/kayda
-- otomatik istek GÖNDERMEZ (Google/Apple/Yandex/HERE/TomTom/OSM/Garmin'e). Admin elle kontrol edip
-- durumu günceller.
CREATE TABLE IF NOT EXISTS map_presence_status (
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  platform TEXT NOT NULL CHECK (platform IN ('GOOGLE', 'APPLE', 'YANDEX', 'HERE', 'TOMTOM', 'OPENSTREETMAP', 'GARMIN')),
  status TEXT NOT NULL DEFAULT 'NOT_CHECKED' CHECK (status IN ('NOT_CHECKED', 'EXISTS_CORRECT', 'NEEDS_CORRECTION', 'CLAIM_STARTED', 'ADDITION_SUBMITTED', 'AWAITING_VERIFICATION', 'VERIFIED', 'BLOCKED')),
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (villa, platform)
);
