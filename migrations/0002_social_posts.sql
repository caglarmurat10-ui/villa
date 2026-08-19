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
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS social_posts_schedule_idx ON social_posts (status, scheduled_date);
