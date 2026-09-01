import { getCloudflareContext } from "@opennextjs/cloudflare";

// Yerel hava istasyonu (WS90, Shelly gateway üzerinden) — tek canonical veri katmanı.
// Cihazın fiziksel konumu kullanıcı tarafından doğrulandı: iki villanın arasında, her ikisine de
// yakın — bu yüzden başlık/metinlerde artık "Patara'da Şu An" + "Villa Safira ve Villa Destan
// yakınındaki yerel hava istasyonu" ifadesi kullanılabilir (bkz. src/app/site/page.tsx).
const KV_KEY = "weather:latest";

export type SpeedUnit = "m/s" | "km/h" | "mph" | "kn";
export type PrecipitationUnit = "mm" | "in";

export interface WeatherReading {
  temperature: number;
  humidity: number;
  pressure: number;
  dewPoint: number;
  windSpeed: number;
  windSpeedUnit: SpeedUnit;
  gustSpeed: number;
  gustSpeedUnit: SpeedUnit;
  windDirection: number;
  precipitation: number;
  precipitationUnit: PrecipitationUnit;
  raining: boolean;
  uvIndex: number;
  illumination?: number;
  observedAt: string;
}

// Public'e çıkan, cihazdan gelen ham/özel alanları (battery, capacitor, rssi, MAC, gateway/LAN IP,
// internal device id, token) asla içermeyen görüntülenebilir alan seti.
export interface PublicWeatherReading {
  temperatureC: number;
  humidityPct: number;
  pressureHpa: number;
  dewPointC: number;
  windSpeedKmh: number | null;
  gustSpeedKmh: number | null;
  windDirection: { degrees: number; abbr: string; name: string };
  precipitationMm: number | null;
  raining: boolean;
  uvIndex: number;
  illumination?: number;
  apparentTemperatureC: number | null;
  observedAt: string;
  freshness: WeatherFreshness;
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

export type WeatherFreshness = "live" | "recent" | "stale";

// 0-10 dk: canlı. 10-30 dk: "Son ölçüm: X dk önce". 30 dk+: sayılar hiç gösterilmez, yalnızca
// "Veri geçici olarak güncellenemiyor" — eski veri asla canlıymış gibi sunulmaz.
export function weatherFreshness(observedAtIso: string): WeatherFreshness {
  const minutes = minutesSince(observedAtIso);
  if (minutes <= 10) return "live";
  if (minutes <= 30) return "recent";
  return "stale";
}

// Yalnızca kaynağın kendi bildirdiği birimden dönüştürür — hiçbir birim varsayılmaz.
export function toKmh(value: number, unit: SpeedUnit): number {
  switch (unit) {
    case "m/s":
      return value * 3.6;
    case "mph":
      return value * 1.60934;
    case "kn":
      return value * 1.852;
    case "km/h":
    default:
      return value;
  }
}

export function toMm(value: number, unit: PrecipitationUnit): number {
  return unit === "in" ? value * 25.4 : value;
}

// Avustralya Meteoroloji Bürosu "Apparent Temperature" (AT) formülü — tanınmış, tek bir
// meteorolojik yöntem (rastgele/uydurma bir katsayı değil). Girdi: °C, %, km/s.
export function apparentTemperatureC(tempC: number, humidityPct: number, windSpeedKmh: number): number {
  const windMs = windSpeedKmh / 3.6;
  const vaporPressure = (humidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return tempC + 0.33 * vaporPressure - 0.7 * windMs - 4.0;
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

// Ham KV kaydını, public UI/endpoint için güvenli+birim-normalize edilmiş forma çevirir.
// 30 dk'dan eski okumalarda sayısal alanlar döndürülmez (freshness:"stale") — çağıran taraf
// bu durumda yalnızca fallback metni göstermelidir.
export function toPublicReading(reading: WeatherReading): PublicWeatherReading {
  const freshness = weatherFreshness(reading.observedAt);
  const windKmh = toKmh(reading.windSpeed, reading.windSpeedUnit);
  const gustKmh = toKmh(reading.gustSpeed, reading.gustSpeedUnit);
  const precipMm = toMm(reading.precipitation, reading.precipitationUnit);
  const direction = windDirectionLabel(reading.windDirection);
  return {
    temperatureC: reading.temperature,
    humidityPct: reading.humidity,
    pressureHpa: reading.pressure,
    dewPointC: reading.dewPoint,
    windSpeedKmh: freshness === "stale" ? null : windKmh,
    gustSpeedKmh: freshness === "stale" ? null : gustKmh,
    windDirection: { degrees: reading.windDirection, abbr: direction.abbr, name: direction.name },
    precipitationMm: freshness === "stale" ? null : precipMm,
    raining: reading.raining,
    uvIndex: reading.uvIndex,
    illumination: reading.illumination,
    apparentTemperatureC: freshness === "stale" ? null : apparentTemperatureC(reading.temperature, reading.humidity, windKmh),
    observedAt: reading.observedAt,
    freshness,
  };
}
