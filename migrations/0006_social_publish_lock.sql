ALTER TABLE social_posts ADD COLUMN publish_lock_token TEXT;
ALTER TABLE social_posts ADD COLUMN publish_lock_expires_at TEXT;

CREATE INDEX IF NOT EXISTS social_posts_publish_lock_idx
ON social_posts (status, approval_status, publish_lock_expires_at);
