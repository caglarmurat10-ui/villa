import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listMapPresence, setMapPresenceStatus, MAP_PLATFORMS, MAP_PRESENCE_STATUSES } from "@/lib/map-presence";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  platform: z.enum(MAP_PLATFORMS),
  status: z.enum(MAP_PRESENCE_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export async function GET() {
  const entries = await listMapPresence();
  return NextResponse.json({ entries });
}

// Yalnız durum/iş akışı GÜNCELLER - hiçbir dış harita servisine istek GÖNDERMEZ (bkz.
// map-presence.ts üstündeki not). Gerçek başvuru işletme sahibi tarafından ilgili resmi kanaldan
// elle yapılır; bu yalnız o sürecin ilerlemesini kaydeder.
export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz istek." }, { status: 400 });
  }
  const entry = await setMapPresenceStatus(parsed.data.villa, parsed.data.platform, parsed.data.status, parsed.data.note);
  return NextResponse.json({ entry });
}
