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
