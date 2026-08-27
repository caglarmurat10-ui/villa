CREATE INDEX IF NOT EXISTS regional_content_recent_idx
ON regional_content_ideas (created_at DESC);

CREATE INDEX IF NOT EXISTS regional_content_cache_idx
ON regional_content_ideas (region, topic, expires_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS instagram_media_insights_villa_published_idx
ON instagram_media_insights (villa, published_at DESC);
