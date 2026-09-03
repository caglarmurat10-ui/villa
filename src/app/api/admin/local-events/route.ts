import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createLocalEventCandidate, listLocalEventCandidates } from "@/lib/local-events";

export const dynamic = "force-dynamic";

// Faz 6 bölüm 4 - haftalık kaynak kontrolü iş akışı: admin gerçek bir etkinlik bulduğunda kaynak
// URL + kaynak adı ile birlikte burada kaydeder. Hiçbir aday otomatik AUTO_SAFE/approved olmaz -
// yalnız GET/POST var, publish/approve ayrı bir admin aksiyonu ([id]/route.ts PATCH).
const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(1000).optional(),
  eventDate: z.iso.date(),
  eventDateEnd: z.iso.date().optional().nullable(),
  venue: z.string().trim().max(200).optional(),
  feeInfo: z.string().trim().max(200).optional(),
  sourceName: z.string().trim().min(2).max(200),
  sourceUrl: z.string().trim().url().max(500),
});

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const validStatuses = ["pending_review", "approved", "rejected", "published"] as const;
  const statusFilter = validStatuses.find((s) => s === status);
  const candidates = await listLocalEventCandidates(statusFilter);
  return NextResponse.json({ candidates });
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz etkinlik bilgisi." }, { status: 400 });
  }
  try {
    const candidate = await createLocalEventCandidate(parsed.data);
    return NextResponse.json({ candidate }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Etkinlik adayı kaydedilemedi." }, { status: 500 });
  }
}
