CREATE TABLE IF NOT EXISTS social_post_media (
  post_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  media_url TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image','video')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, position)
);

CREATE INDEX IF NOT EXISTS social_post_media_post_idx
  ON social_post_media(post_id, position);
