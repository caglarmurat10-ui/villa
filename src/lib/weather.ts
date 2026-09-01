import { getCloudflareContext } from "@opennextjs/cloudflare";

// Yerel hava istasyonu (WS90/Shelly Gateway) — tek canonical veri katmanı.
// Cihazın fiziksel konumu villa bölgesi olarak DOĞRULANMADI — bu yüzden başlık/metinlerde
// "Villa Safira/Destan'da" veya "Patara'da" değil, nötr "Yerel Hava İstasyonu" ifadesi kullanılır.
const KV_KEY = "weather:latest";
const STALE_AFTER_MINUTES = 10;

export interface WeatherReading {
  temperature: number;
  humidity: number;
  pressure: number;
  dewPoint: number;
  windSpeed: number;
  gustSpeed: number;
  windDirection: number;
  precipitation: number;
  raining: boolean;
  uvIndex: number;
  illumination?: number;
  observedAt: string;
}

async function kv() {
  const { env } = await getCloudflareContext({ async: true });
  return env.META_PRIVATE;
}

export async function getLatestWeather(): Promise<WeatherReading | null> {
  const store = await kv();
  const raw = await store.get(KV_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WeatherReading;
    if (typeof parsed.observedAt !== "string" || typeof parsed.temperature !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLatestWeather(reading: WeatherReading): Promise<void> {
  const store = await kv();
  await store.put(KV_KEY, JSON.stringify(reading), { expirationTtl: 60 * 60 * 24 });
}

export async function getLastIngestAt(): Promise<number> {
  const store = await kv();
  const raw = await store.get("weather:last-ingest-ms");
  return raw ? Number.parseInt(raw, 10) || 0 : 0;
}

export async function setLastIngestAt(ms: number): Promise<void> {
  const store = await kv();
  await store.put("weather:last-ingest-ms", String(ms), { expirationTtl: 60 * 10 });
}

export function minutesSince(observedAtIso: string): number {
  const observed = Date.parse(observedAtIso);
  if (Number.isNaN(observed)) return Number.POSITIVE_INFINITY;
  return (Date.now() - observed) / 60000;
}

export function isStale(observedAtIso: string): boolean {
  return minutesSince(observedAtIso) > STALE_AFTER_MINUTES;
}

const COMPASS_POINTS: { max: number; abbr: string; name: string }[] = [
  { max: 22.5, abbr: "K", name: "Yıldız" },
  { max: 67.5, abbr: "KD", name: "Poyraz" },
  { max: 112.5, abbr: "D", name: "Gündoğusu" },
  { max: 157.5, abbr: "GD", name: "Keşişleme" },
  { max: 202.5, abbr: "G", name: "Kıble" },
  { max: 247.5, abbr: "GB", name: "Lodos" },
  { max: 292.5, abbr: "B", name: "Günbatısı" },
  { max: 337.5, abbr: "KB", name: "Karayel" },
  { max: 360.01, abbr: "K", name: "Yıldız" },
];

export function windDirectionLabel(degrees: number): { abbr: string; name: string } {
  const normalized = ((degrees % 360) + 360) % 360;
  const point = COMPASS_POINTS.find((p) => normalized <= p.max) ?? COMPASS_POINTS[0];
  return { abbr: point.abbr, name: point.name };
}
