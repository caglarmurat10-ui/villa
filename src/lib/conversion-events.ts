import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "./types";

// Hafif Cloudflare-first (D1) dönüşüm günlüğü - bkz. migrations/0025_conversion_events.sql.
// social-db.ts'teki ensureTable() deseniyle aynı: migration dosyası + runtime self-heal (migration
// elle uygulanmayı unutulsa/gecikse bile özellik production'da çalışır durumda kalır).
export const CONVERSION_EVENT_NAMES = [
  "page_view",
  "whatsapp_click",
  "booking_click",
  "contact_submit",
  "instagram_click",
  "facebook_click",
] as const;

export type ConversionEventName = (typeof CONVERSION_EVENT_NAMES)[number];

export type ConversionEventInput = {
  eventName: ConversionEventName;
  villa?: Villa | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  landingPath?: string | null;
  referrerHost?: string | null;
};

export type ConversionEventSummaryRow = {
  eventName: ConversionEventName;
  utmSource: string | null;
  count: number;
};

let tableReady: Promise<void> | null = null;

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

async function prepareTable(db: D1Database): Promise<void> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS conversion_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      villa TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      landing_path TEXT,
      referrer_host TEXT,
      created_at TEXT NOT NULL
    )`.replace(/\s+/g, " "),
  );
}

async function ensureTable(db: D1Database): Promise<void> {
  if (!tableReady) {
    tableReady = prepareTable(db).catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

// Uzunluk sınırları: kullanıcı kontrolündeki (URL query string'den gelen) alanların D1'e sınırsız
// büyüklükte yazılmasını önler - kötüye kullanım/hata durumunda satır başına makul bir üst sınır.
function clip(value: string | null | undefined, maxLength = 120): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export async function recordConversionEvent(input: ConversionEventInput): Promise<void> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO conversion_events (event_name, villa, utm_source, utm_medium, utm_campaign, utm_content, landing_path, referrer_host, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    input.eventName,
    input.villa ?? null,
    clip(input.utmSource),
    clip(input.utmMedium),
    clip(input.utmCampaign),
    clip(input.utmContent),
    clip(input.landingPath, 200),
    clip(input.referrerHost),
    now,
  ).run();
}

export async function getConversionEventSummary(sinceIso: string): Promise<ConversionEventSummaryRow[]> {
  const db = await database();
  await ensureTable(db);
  const result = await db.prepare(
    `SELECT event_name, utm_source, COUNT(*) as count
     FROM conversion_events
     WHERE created_at >= ?
     GROUP BY event_name, utm_source
     ORDER BY count DESC`,
  ).bind(sinceIso).all<{ event_name: ConversionEventName; utm_source: string | null; count: number }>();
  return (result.results ?? []).map((row) => ({
    eventName: row.event_name,
    utmSource: row.utm_source,
    count: Number(row.count),
  }));
}

export async function getConversionEventTotals(sinceIso: string): Promise<Record<ConversionEventName, number>> {
  const db = await database();
  await ensureTable(db);
  const result = await db.prepare(
    `SELECT event_name, COUNT(*) as count FROM conversion_events WHERE created_at >= ? GROUP BY event_name`,
  ).bind(sinceIso).all<{ event_name: ConversionEventName; count: number }>();
  const totals = Object.fromEntries(CONVERSION_EVENT_NAMES.map((name) => [name, 0])) as Record<ConversionEventName, number>;
  for (const row of result.results ?? []) {
    totals[row.event_name] = Number(row.count);
  }
  return totals;
}

export type PropertyTrafficRow = { villa: Villa; eventName: ConversionEventName; count: number };

// "traffic by property" (bölüm 8) - villa NULL olan satırlar (villa'ya özgü olmayan sayfa
// görüntülemeleri, ör. anasayfa) burada bilerek DIŞLANIR, yalnız gerçekten bir villaya atfedilen
// event'ler sayılır - "hangi villa daha çok ilgi görüyor" sorusuna uydurma olmayan bir cevap.
export async function getConversionEventsByProperty(sinceIso: string): Promise<PropertyTrafficRow[]> {
  const db = await database();
  await ensureTable(db);
  const result = await db.prepare(
    `SELECT villa, event_name, COUNT(*) as count FROM conversion_events
     WHERE created_at >= ? AND villa IS NOT NULL
     GROUP BY villa, event_name ORDER BY count DESC`,
  ).bind(sinceIso).all<{ villa: Villa; event_name: ConversionEventName; count: number }>();
  return (result.results ?? []).map((row) => ({ villa: row.villa, eventName: row.event_name, count: Number(row.count) }));
}

export type LandingPageRow = { landingPath: string; count: number };

// "best landing pages" - yalnız page_view event'lerinden, gerçekten kaydedilmiş landing_path
// değerlerinden hesaplanır (bkz. AttributionCapture.tsx - her public sayfa yüklemesinde bir kez).
export async function getTopLandingPages(sinceIso: string, limit = 10): Promise<LandingPageRow[]> {
  const db = await database();
  await ensureTable(db);
  const result = await db.prepare(
    `SELECT landing_path, COUNT(*) as count FROM conversion_events
     WHERE created_at >= ? AND event_name = 'page_view' AND landing_path IS NOT NULL
     GROUP BY landing_path ORDER BY count DESC LIMIT ?`,
  ).bind(sinceIso, limit).all<{ landing_path: string; count: number }>();
  return (result.results ?? []).map((row) => ({ landingPath: row.landing_path, count: Number(row.count) }));
}

export interface ConversionRateSummary {
  pageViews: number;
  conversions: number; // whatsapp_click + booking_click + contact_submit toplamı - "gerçek niyet" sinyalleri
  ratePercent: number; // pageViews=0 ise 0 döner, bölme hatası/NaN asla dışa sızmaz
}

// "conversion rate" (bölüm 8) - yalnız gerçekten kaydedilmiş event sayımlarından hesaplanır,
// hiçbir sektör ortalaması/varsayım kullanılmaz.
export async function getConversionRate(sinceIso: string): Promise<ConversionRateSummary> {
  const totals = await getConversionEventTotals(sinceIso);
  const conversions = totals.whatsapp_click + totals.booking_click + totals.contact_submit;
  const pageViews = totals.page_view;
  const ratePercent = pageViews > 0 ? Math.round((conversions / pageViews) * 1000) / 10 : 0;
  return { pageViews, conversions, ratePercent };
}
