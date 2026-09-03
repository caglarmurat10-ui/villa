import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

export interface ContentLibrarySummary {
  autoSafePending: number;
  reviewRequired: number;
  blocked: number;
}

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

// social_content_library D1 tablosu - spreadsheet reconciliation'ının staging katmanı, social_posts
// operasyon tablosundan ve src/lib/social-content-library.ts'teki (JSON tabanlı, farklı/önceki bir
// içerik kaynağı) socialContentTemplates'ten TAMAMEN bağımsız. Bu yalnız admin panelinde gerçek
// automation_class dağılımını göstermek için.
export interface PublishStats {
  windowDays: number;
  publishedCount: number;
  failedCount: number; // AKTİF hata - cron hâlâ yeniden deneyecek (publish_attempt_count < MAX_ATTEMPTS), gerçek alarm
  legacyFailedCount: number; // denemeleri TÜKENMİŞ (publish_attempt_count >= MAX_ATTEMPTS) - cron bir daha ASLA denemez, yeni bir otomasyon sorunu DEĞİL, yalnız audit için görünür
  byPlatform: { platform: string; published: number; failed: number; legacyFailed: number }[];
}

// custom-worker.mjs'teki MAX_ATTEMPTS ile AYNI değer (üç bağımsız kopya deseni - bkz.
// REGION_GUIDE_SLUGS notu, custom-worker.mjs derlenmiş TS modüllerini import edemiyor). Bu satır
// custom-worker.mjs'in kendi sabitiyle senkron kalmalı - orada değişirse burada da değişmeli.
const CRON_MAX_ATTEMPTS = 3;

// Yalnız D1'de gerçekten sahip olduğumuz veri: yayın denemesi/başarı istatistiği. Site trafiği,
// WhatsApp lead, maps/rehber click gibi metrikler GA4 Data API bağlanmadan ASLA burada gösterilmez
// (bkz. google-visibility.ts - "Permissions yoksa uydurma data gösterme" kuralı).
//
// Faz 6.1 bölüm 8 - denemeleri tükenmiş (>= CRON_MAX_ATTEMPTS) bir satır cron tarafından BİR DAHA
// ASLA seçilmez (bkz. custom-worker.mjs duePosts filtresi) - bu yüzden "failed" ile karıştırılırsa
// çözülmüş/eski bir sorun sanki HÂLÂ aktifmiş gibi sonsuza kadar alarm üretir. İkisi ayrı sayılır.
export async function getPublishStats(windowDays: number, todayIso: string): Promise<PublishStats> {
  const db = await database();
  const sinceDate = new Date(Date.parse(todayIso) - windowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = await db.prepare(
    `SELECT platform,
       SUM(CASE WHEN status = 'Yayınlandı' AND published_at >= ? THEN 1 ELSE 0 END) as published,
       SUM(CASE WHEN status = 'Planlandı' AND last_publish_error IS NOT NULL AND last_publish_attempt_at >= ? AND COALESCE(publish_attempt_count, 0) < ? THEN 1 ELSE 0 END) as failed,
       SUM(CASE WHEN status = 'Planlandı' AND last_publish_error IS NOT NULL AND COALESCE(publish_attempt_count, 0) >= ? THEN 1 ELSE 0 END) as legacy_failed
     FROM social_posts
     GROUP BY platform`,
  ).bind(sinceDate, sinceDate, CRON_MAX_ATTEMPTS, CRON_MAX_ATTEMPTS).all<{ platform: string; published: number; failed: number; legacy_failed: number }>();
  const byPlatform = (rows.results ?? []).map((r) => ({ platform: r.platform, published: r.published ?? 0, failed: r.failed ?? 0, legacyFailed: r.legacy_failed ?? 0 }));
  return {
    windowDays,
    publishedCount: byPlatform.reduce((sum, r) => sum + r.published, 0),
    failedCount: byPlatform.reduce((sum, r) => sum + r.failed, 0),
    legacyFailedCount: byPlatform.reduce((sum, r) => sum + r.legacyFailed, 0),
    byPlatform,
  };
}

export interface PostAutomationClass {
  postId: string;
  automationClass: "AUTO_SAFE" | "REVIEW_REQUIRED" | "BLOCKED" | null;
}

// social_posts.id -> automation_class eşlemesi (promoted_post_id üzerinden). Mobil sosyal ekranının
// her postta AUTO_SAFE/REVIEW_REQUIRED/BLOCKED rozetini göstermesi için - social_posts'un kendisi bu
// alanı taşımıyor, yalnız content_library'de var.
export async function getPostAutomationClasses(): Promise<Record<string, PostAutomationClass["automationClass"]>> {
  const db = await database();
  const rows = await db.prepare(
    "SELECT promoted_post_id, automation_class FROM social_content_library WHERE promoted_post_id IS NOT NULL",
  ).all<{ promoted_post_id: string; automation_class: string }>();
  const map: Record<string, PostAutomationClass["automationClass"]> = {};
  for (const row of rows.results ?? []) {
    map[row.promoted_post_id] = row.automation_class as PostAutomationClass["automationClass"];
  }
  return map;
}

export async function getContentLibrarySummary(): Promise<ContentLibrarySummary> {
  const db = await database();
  const rows = await db.prepare(
    "SELECT automation_class, COUNT(*) as n FROM social_content_library GROUP BY automation_class",
  ).all<{ automation_class: string; n: number }>();
  const summary: ContentLibrarySummary = { autoSafePending: 0, reviewRequired: 0, blocked: 0 };
  for (const row of rows.results ?? []) {
    if (row.automation_class === "AUTO_SAFE") summary.autoSafePending = row.n;
    else if (row.automation_class === "REVIEW_REQUIRED") summary.reviewRequired = row.n;
    else if (row.automation_class === "BLOCKED") summary.blocked = row.n;
  }
  return summary;
}
