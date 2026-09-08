import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CONVERSION_EVENT_NAMES, recordConversionEvent } from "@/lib/conversion-events";
import { clientIpFromHeaders, isRateLimited, recordRateLimitHit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT_SCOPE = "PUBLIC_TRACK_EVENT";
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 40; // sayfa görüntülemesi + birkaç CTA tıklaması için yeterli, spam beacon için değil

const schema = z.object({
  eventName: z.enum(CONVERSION_EVENT_NAMES),
  villa: z.enum(["Safira", "Destan"]).nullish(),
  utmSource: z.string().trim().max(120).nullish(),
  utmMedium: z.string().trim().max(120).nullish(),
  utmCampaign: z.string().trim().max(120).nullish(),
  utmContent: z.string().trim().max(120).nullish(),
  landingPath: z.string().trim().max(200).nullish(),
});

function referrerHost(request: NextRequest): string | null {
  const referrer = request.headers.get("referer");
  if (!referrer) return null;
  try {
    return new URL(referrer).host;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);
  if (await isRateLimited(ip, RATE_LIMIT_SCOPE, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)) {
    return NextResponse.json({ error: "Çok fazla istek." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  await recordRateLimitHit(ip, RATE_LIMIT_SCOPE);
  await recordConversionEvent({
    eventName: parsed.data.eventName,
    villa: parsed.data.villa ?? null,
    utmSource: parsed.data.utmSource ?? null,
    utmMedium: parsed.data.utmMedium ?? null,
    utmCampaign: parsed.data.utmCampaign ?? null,
    utmContent: parsed.data.utmContent ?? null,
    landingPath: parsed.data.landingPath ?? null,
    referrerHost: referrerHost(request),
  }).catch((error) => {
    console.error(`[track] conversion_events yazılamadı: ${error instanceof Error ? error.message : "unknown"}`);
  });

  return new NextResponse(null, { status: 204 });
}
