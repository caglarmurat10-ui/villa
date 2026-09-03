import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLocalEventCandidate, setLocalEventCandidateStatus } from "@/lib/local-events";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["pending_review", "approved", "rejected", "published"]),
});

// "approved" bile otomatik yayın DEĞİLDİR - yalnız "bu etkinlik gerçek/doğrulandı" anlamına gelir.
// Gerçek bir sosyal gönderi hâlâ admin'in normal içerik oluşturma akışından, LOCAL EVENT şablonunu
// (bkz. social-design-templates.tsx renderLocalEvent) bu adayın id'siyle referanslayarak elle
// oluşturulur - hiçbir otomatik/zamanlanmış görev bu adaydan kendiliğinden bir post ÜRETMEZ.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
  }
  const existing = await getLocalEventCandidate(id);
  if (!existing) return NextResponse.json({ error: "Etkinlik adayı bulunamadı." }, { status: 404 });
  const candidate = await setLocalEventCandidateStatus(id, parsed.data.status);
  return NextResponse.json({ candidate });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await getLocalEventCandidate(id);
  if (!candidate) return NextResponse.json({ error: "Etkinlik adayı bulunamadı." }, { status: 404 });
  return NextResponse.json({ candidate });
}
