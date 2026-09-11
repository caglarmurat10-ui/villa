import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 2026-09-11 nötr Cuma geçişinden önce üretilmiş planlı Cuma satırlarını yerinde düzeltir.
 * Sabit pencere yalnız o anda mevcut 30 günlük legacy seed'leri kapsar; yeni kayıtlar zaten
 * social-plan-seed.ts üzerinden nötr caption ile üretilir.
 */
export async function reconcileLegacyFridayPosts() {
  const { env } = await getCloudflareContext({ async: true });
  const now = new Date().toISOString();
  const result = await env.DB.prepare(`UPDATE social_posts
    SET caption = trim(substr(caption, 1, instr(caption, char(10) || char(10)) - 1)),
        publish_attempt_count = 0,
        last_publish_attempt_at = NULL,
        last_publish_error = NULL,
        publish_lock_token = NULL,
        publish_lock_expires_at = NULL,
        updated_at = ?
    WHERE status = 'Planlandı'
      AND scheduled_date >= '2026-09-11'
      AND scheduled_date < '2026-10-11'
      AND strftime('%w', scheduled_date) = '5'
      AND media_url LIKE '%_special-day_%'
      AND instr(caption, char(10) || char(10) || 'Villa ') > 0
      AND caption LIKE '%#patara%'
      AND caption LIKE '%#kaş%'
      AND caption LIKE '%#antalya%'`)
    .bind(now)
    .run();
  return Number(result.meta?.changes ?? 0);
}
