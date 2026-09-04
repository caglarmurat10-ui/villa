-- Eski sosyal planlardan kalan, Reels olarak işaretlenmiş fakat tek bir doğrulanmış video
-- medyası taşımayan satırlar */15 yayın cron'unda her tur 409 ile tekrar seçiliyordu.
-- Yeni planlayıcı bu tip satırları artık üretmiyor; bu migration yalnız legacy kuyruğu güvenli
-- biçimde insan onayına çeker. İçerik silinmez, status değişmez ve ileride doğru video eklenerek
-- yeniden onaylanabilir.
UPDATE social_posts
SET approval_status = 'İnsan onayı',
    approved_at = NULL,
    last_publish_error = 'Reels için tek bir doğrulanmış video gerekli; otomatik yayın durduruldu.',
    publish_lock_token = NULL,
    publish_lock_expires_at = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE status = 'Planlandı'
  AND approval_status = 'Onaylandı'
  AND content_type = 'Reels'
  AND (
    (SELECT COUNT(*) FROM social_post_media m WHERE m.post_id = social_posts.id) <> 1
    OR
    (SELECT COUNT(*) FROM social_post_media m WHERE m.post_id = social_posts.id AND m.media_kind = 'video') <> 1
  );
