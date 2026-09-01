import { NextResponse } from "next/server";
import { getLatestWeather, toPublicReading } from "@/lib/weather";

export const dynamic = "force-dynamic";

// Public, salt-okunur uç: yalnız allowlist edilmiş, birim-normalize edilmiş alanları döner.
// battery/capacitor/rssi/MAC/gateway-LAN IP/internal id/token asla dönmez (WeatherReading'te
// zaten bu alanlar tutulmuyor). 30 dk'dan eski okuma varsa sayısal alanlar null döner.
export async function GET() {
  const reading = await getLatestWeather();
  const body = reading ? { ok: true, data: toPublicReading(reading) } : { ok: false, data: null };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
