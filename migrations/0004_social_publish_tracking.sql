ALTER TABLE social_posts ADD COLUMN platform_post_id TEXT;
ALTER TABLE social_posts ADD COLUMN publish_attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN last_publish_attempt_at TEXT;
ALTER TABLE social_posts ADD COLUMN last_publish_error TEXT;

CREATE INDEX IF NOT EXISTS social_posts_publish_state_idx
ON social_posts (status, approval_status, scheduled_date, last_publish_attempt_at);
