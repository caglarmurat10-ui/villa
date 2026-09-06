import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import { gbpContentLibrary, type GbpPostDraft } from "../google-business-content";
import { socialDriveMedia } from "../social-drive-media";
import { getGbpLocationMapping } from "./mapping";
import { buildGbpCtaUrl, publishGbpLocalPost, type GbpLocalPostInput } from "./posts";
import type { Villa } from "../types";

// Kullanıcının açık isteğiyle GBP gönderileri artık zamanlanmış cron'dan otomatik yayınlanıyor
// (bkz. custom-worker.mjs runGbpPostCronIfDue). Bu, posts.ts'in orijinal "yalnız admin action'ı"
// tasarımının BİLEREK üzerine çıkan, kullanıcıyla konuşulmuş bir karardır - güvenlik ağı olarak:
// (1) içerik tamamen sabit/önceden yazılmış gbpContentLibrary'den gelir, hiçbir AI/serbest metin
// üretimi yok; (2) GBP_AUTO_POST_ENABLED aşağıdaki kill-switch ile anında kapatılabilir; (3) her
// deneme (başarılı/başarısız) gbp_posts tablosuna yazılır, panelde görünür.
export const GBP_AUTO_POST_ENABLED = true;

let tablesReady: Promise<void> | null = null;

async function ensureTables(db: D1Database) {
  if (!tablesReady) {
    tablesReady = db.prepare(`CREATE TABLE IF NOT EXISTS gbp_posts (
      id TEXT PRIMARY KEY,
      villa TEXT NOT NULL CHECK (villa IN ('Safira','Destan')),
      category TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('PUBLISHED','FAILED')),
      post_name TEXT,
      media_url TEXT,
      error TEXT,
      attempted_at TEXT NOT NULL
    )`).run().then(() => undefined).catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  await tablesReady;
}

async function context() {
  return getCloudflareContext({ async: true });
}

// mediaHint iki türden biri: gerçek villa fotoğrafı için tanımlayıcı bir dosya adı ipucu (ör.
// "safira-havuz-genel-manzara.jpg") veya "region-guide:<slug>" (bölge rehberi görseli, mevcut
// Social Design Engine şablonundan - src/lib/social-design-templates.tsx). Her iki durumda da
// sonuç, Meta yayınında zaten kanıtlanmış, kimliksiz erişilebilir gerçek bir görsel URL'idir -
// hiçbir görsel burada uydurulmaz/üretilmez.
export function resolveGbpMediaUrl(baseUrl: string, villa: Villa, mediaHint: string): string | null {
  if (mediaHint.startsWith("region-guide:")) {
    const slug = mediaHint.slice("region-guide:".length);
    const villaKey = villa === "Safira" ? "safira" : "destan";
    return `${baseUrl}/api/public/social-assets/${villaKey}_destination_${slug}/feed`;
  }
  const pool = socialDriveMedia.filter((asset) => asset.villa === villa && asset.mediaKind === "image");
  if (!pool.length) return null;
  // Basit, kararlı (rastgele değil) bir seçim - aynı mediaHint her zaman aynı gerçek fotoğrafa
  // eşlenir, art arda iki farklı kategori aynı fotoğrafı seçme olasılığı düşer.
  let hash = 0;
  for (let i = 0; i < mediaHint.length; i += 1) hash = (hash * 31 + mediaHint.charCodeAt(i)) >>> 0;
  return `${baseUrl}${pool[hash % pool.length].proxyPath}`;
}

export function draftToInput(villa: Villa, draft: GbpPostDraft, mediaUrl: string): GbpLocalPostInput {
  const useCta = draft.cta === "website";
  return {
    topicType: "STANDARD",
    summary: draft.body,
    mediaSourceUrl: mediaUrl,
    ctaActionType: useCta ? "LEARN_MORE" : undefined,
    ctaUrl: useCta ? buildGbpCtaUrl(villa, `auto_${draft.category}`) : undefined,
  };
}

// Saf seçim mantığı - hiç paylaşılmamış kategoriler önce (Map'te hiç yoksa "" döner, en küçük
// string olduğu için başa gelir), sonra en eski paylaşılandan başlayarak döngüsel rotasyon.
export function pickNextCategory(categories: string[], lastPosted: Map<string, string>): string {
  return categories.slice().sort((a, b) => (lastPosted.get(a) ?? "").localeCompare(lastPosted.get(b) ?? ""))[0];
}

async function nextCategory(db: D1Database, villa: Villa): Promise<string> {
  const categories = gbpContentLibrary.filter((item) => item.villa === villa).map((item) => item.category);
  const rows = await db
    .prepare("SELECT category, MAX(attempted_at) as last_at FROM gbp_posts WHERE villa = ? AND status = 'PUBLISHED' GROUP BY category")
    .bind(villa)
    .all<{ category: string; last_at: string }>();
  const lastPosted = new Map(rows.results.map((row) => [row.category, row.last_at]));
  return pickNextCategory(categories, lastPosted);
}

async function recordAttempt(
  db: D1Database,
  villa: Villa,
  category: string,
  result: { status: "PUBLISHED" | "FAILED"; postName?: string | null; mediaUrl?: string | null; error?: string | null },
) {
  await db
    .prepare("INSERT INTO gbp_posts (id, villa, category, status, post_name, media_url, error, attempted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), villa, category, result.status, result.postName ?? null, result.mediaUrl ?? null, result.error ?? null, new Date().toISOString())
    .run();
}

export type GbpAutoPostOutcome =
  | { villa: Villa; outcome: "PUBLISHED"; category: string; postName: string | null }
  | { villa: Villa; outcome: "FAILED"; category: string; error: string }
  | { villa: Villa; outcome: "SKIPPED"; reason: string };

export async function runGbpPostForVilla(villa: Villa): Promise<GbpAutoPostOutcome> {
  if (!GBP_AUTO_POST_ENABLED) return { villa, outcome: "SKIPPED", reason: "GBP_AUTO_POST_ENABLED=false (kill switch)" };

  const mapping = await getGbpLocationMapping(villa);
  if (!mapping) return { villa, outcome: "SKIPPED", reason: "GBP konum eşleşmesi yok" };

  const { env } = await context();
  if (!env.DB) return { villa, outcome: "SKIPPED", reason: "DB bağlı değil" };
  await ensureTables(env.DB);

  const category = await nextCategory(env.DB, villa);
  const draft = gbpContentLibrary.find((item) => item.villa === villa && item.category === category);
  if (!draft) return { villa, outcome: "SKIPPED", reason: `"${category}" için taslak bulunamadı` };

  const baseUrl = String(env.APP_BASE_URL ?? "https://admin.safiradestan.com").replace(/\/$/, "");
  const mediaUrl = resolveGbpMediaUrl(baseUrl, villa, draft.mediaHint);
  if (!mediaUrl) {
    await recordAttempt(env.DB, villa, category, { status: "FAILED", error: "Görsel URL'i çözümlenemedi" });
    return { villa, outcome: "FAILED", category, error: "Görsel URL'i çözümlenemedi" };
  }

  const input = draftToInput(villa, draft, mediaUrl);
  const result = await publishGbpLocalPost(mapping.locationName, input);

  if (result.ok) {
    await recordAttempt(env.DB, villa, category, { status: "PUBLISHED", postName: result.postName, mediaUrl });
    return { villa, outcome: "PUBLISHED", category, postName: result.postName };
  }
  const error = result.error ?? "Bilinmeyen hata";
  await recordAttempt(env.DB, villa, category, { status: "FAILED", mediaUrl, error });
  return { villa, outcome: "FAILED", category, error };
}

export async function runGbpPostCron(): Promise<GbpAutoPostOutcome[]> {
  const villas: Villa[] = ["Safira", "Destan"];
  const results: GbpAutoPostOutcome[] = [];
  for (const villa of villas) {
    results.push(await runGbpPostForVilla(villa));
  }
  return results;
}

export async function getRecentGbpPosts(limit = 10) {
  const { env } = await context();
  if (!env.DB) return [];
  await ensureTables(env.DB);
  const rows = await env.DB
    .prepare("SELECT villa, category, status, post_name, error, attempted_at FROM gbp_posts ORDER BY attempted_at DESC LIMIT ?")
    .bind(limit)
    .all<{ villa: Villa; category: string; status: string; post_name: string | null; error: string | null; attempted_at: string }>();
  return rows.results;
}
