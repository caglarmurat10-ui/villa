import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getLastIngestAt, saveLatestWeather, setLastIngestAt } from "@/lib/weather";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4096;
const MIN_INGEST_GAP_MS = 5000;

// Birim alanları ZORUNLU: kaynağın birimini kodda varsaymak yerine her payload'da açıkça
// beyan ettiriyoruz (toKmh/toMm bu beyana göre dönüştürür, asla tahmin etmez).
const schema = z.object({
  temperature: z.number().min(-50).max(60),
  humidity: z.number().min(0).max(100),
  pressure: z.number().min(800).max(1100),
  dew_point: z.number().min(-50).max(60),
  wind_speed: z.number().min(0).max(300),
  wind_speed_unit: z.enum(["m/s", "km/h", "mph", "kn"]),
  gust_speed: z.number().min(0).max(400),
  gust_speed_unit: z.enum(["m/s", "km/h", "mph", "kn"]),
  wind_direction: z.number().min(0).max(360),
  precipitation: z.number().min(0).max(2000),
  precipitation_unit: z.enum(["mm", "in"]),
  raining: z.boolean(),
  uv_index: z.number().min(0).max(20),
  illumination: z.number().min(0).max(300000).optional(),
  observed_at: z.iso.datetime({ offset: true }).or(z.iso.datetime()),
}).strict();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const secret = env.WEATHER_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Servis yapılandırılmadı." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!provided || !timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "İstek gövdesi çok büyük." }, { status: 413 });
  }

  const now = Date.now();
  const lastIngest = await getLastIngestAt();
  if (lastIngest && now - lastIngest < MIN_INGEST_GAP_MS) {
    return NextResponse.json({ error: "Çok sık istek." }, { status: 429 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "İstek gövdesi çok büyük." }, { status: 413 });
  }

  const payload = (() => {
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  })();

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri şeması." }, { status: 400 });
  }

  const observedMs = Date.parse(parsed.data.observed_at);
  const driftMs = Math.abs(now - observedMs);
  if (!Number.isFinite(observedMs) || driftMs > 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "observed_at geçersiz veya çok eski/ileri." }, { status: 400 });
  }

  await saveLatestWeather({
    temperature: parsed.data.temperature,
    humidity: parsed.data.humidity,
    pressure: parsed.data.pressure,
    dewPoint: parsed.data.dew_point,
    windSpeed: parsed.data.wind_speed,
    windSpeedUnit: parsed.data.wind_speed_unit,
    gustSpeed: parsed.data.gust_speed,
    gustSpeedUnit: parsed.data.gust_speed_unit,
    windDirection: parsed.data.wind_direction,
    precipitation: parsed.data.precipitation,
    precipitationUnit: parsed.data.precipitation_unit,
    raining: parsed.data.raining,
    uvIndex: parsed.data.uv_index,
    illumination: parsed.data.illumination,
    observedAt: parsed.data.observed_at,
  });
  await setLastIngestAt(now);

  return NextResponse.json({ ok: true });
}
