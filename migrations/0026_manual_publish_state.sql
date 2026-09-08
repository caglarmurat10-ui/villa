-- Manuel yayın iş akışı (bölüm 6/12 - Destan Instagram dış sahiplik sorunu çözülene kadar).
-- BİLEREK status/platform_post_id'den TAMAMEN AYRI: manual_publish_state ASLA gerçek Meta Graph
-- API yayınıyla karıştırılamaz - MANUALLY_PUBLISHED olsa bile platform_post_id her zaman NULL kalır
-- (yalnız markSocialPublishSuccess() bu alanı yazar, o da yalnız gerçek Graph API yanıtından).
ALTER TABLE social_posts ADD COLUMN manual_publish_state TEXT
  CHECK (manual_publish_state IN ('READY_FOR_MANUAL_PUBLISH', 'MANUALLY_PUBLISHED') OR manual_publish_state IS NULL);
ALTER TABLE social_posts ADD COLUMN manually_published_at TEXT;
