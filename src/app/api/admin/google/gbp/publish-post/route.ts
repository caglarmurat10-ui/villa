import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getGbpLocationMapping } from "@/lib/gbp/mapping";
import { publishGbpLocalPost, buildGbpCtaUrl, type GbpLocalPostInput } from "@/lib/gbp/posts";

export const dynamic = "force-dynamic";

// Faz 6 bölüm 17 - GERÇEK bir Google Business Profile Local Post gönderir. Bu rota HİÇBİR
// otomatik/zamanlanmış görevden çağrılmaz - yalnız admin panelinden, İNSAN tarafından, açıkça
// tetiklenmelidir (bkz. gbp/posts.ts dosya başı notu). "confirm: true" alanı bilinçli bir ikinci
// onay katmanı - yanlışlıkla tetiklenen bir istek asla gerçek bir yayına dönüşmesin diye.
const schema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  topicType: z.enum(["STANDARD", "EVENT", "OFFER"]),
  summary: z.string().trim().min(10).max(1500),
  mediaSourceUrl: z.string().trim().url(),
  ctaActionType: z.enum(["BOOK", "LEARN_MORE"]).optional(),
  campaign: z.string().trim().min(2).max(60).default("gbp_organic"),
  event: z.object({
    title: z.string().trim().min(2).max(100),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  }).optional(),
  confirm: z.literal(true),
});

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz istek." }, { status: 400 });
  }
  const { villa, topicType, summary, mediaSourceUrl, ctaActionType, campaign, event } = parsed.data;

  const mapping = await getGbpLocationMapping(villa);
  if (!mapping) {
    return NextResponse.json({ error: `Villa ${villa} için GBP location eşlemesi yapılmamış - önce /entegrasyonlar üzerinden gerçek location seçilmeli.` }, { status: 409 });
  }

  const input: GbpLocalPostInput = {
    topicType,
    summary,
    mediaSourceUrl,
    ctaActionType,
    ctaUrl: ctaActionType ? buildGbpCtaUrl(villa, campaign) : undefined,
    event: topicType === "EVENT" && event ? { title: event.title, schedule: { startDate: event.startDate, endDate: event.endDate } } : undefined,
  };

  const result = await publishGbpLocalPost(mapping.locationName, input);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, httpStatus: result.httpStatus }, { status: 502 });
  }
  return NextResponse.json({ ok: true, postName: result.postName, state: result.state });
}
