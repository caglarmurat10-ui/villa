import { NextRequest, NextResponse } from "next/server";
import { resolveExportToken } from "@/lib/ota/kv";
import { buildExportEvents } from "@/lib/ota/export";
import { buildIcsFeed } from "@/lib/ota/ics-writer";

export const dynamic = "force-dynamic";

// Public, opak-token korumalı export feed - Airbnb/Booking bunu import URL'si olarak kullanır.
// Token URL'den villa/platform tahmini vermez (eşleme yalnız OTA_PRIVATE KV'de). PII yok: yalnız
// DTSTART/DTEND/UID/SUMMARY:"Reserved" (bkz. buildIcsFeed, buildExportEvents).
export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await context.params;
  const token = rawToken.endsWith(".ics") ? rawToken.slice(0, -4) : rawToken;

  const record = await resolveExportToken(token);
  if (!record) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const events = await buildExportEvents(record.villa, record.excludeSource);
  const ics = buildIcsFeed(events);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
    },
  });
}
