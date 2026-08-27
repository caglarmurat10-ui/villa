import { requireAiAdmin } from "@/lib/aiAdminSession";
import { generateAiContent } from "@/lib/aiContentStudio";
import { AI_MODES, AI_PURPOSES, type AiMode, type AiPurpose } from "@/lib/aiTypes";
import { availabilityPriceText, getSocialSettings, listAvailability, socialOperationsDb } from "@/lib/socialOperationsDb";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";
const isVilla = (value: unknown): value is Villa => value === "Destan" || value === "Safira";
const isMode = (value: unknown): value is AiMode => typeof value === "string" && AI_MODES.includes(value as AiMode);
const isPurpose = (value: unknown): value is AiPurpose => typeof value === "string" && AI_PURPOSES.includes(value as AiPurpose);

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!isVilla(body.villa) || !isMode(body.mode) || !isPurpose(body.purpose)) throw new Error("AI içerik seçimi geçersiz.");
    const { db, env } = await socialOperationsDb();
    if (!(await requireAiAdmin(request, env, true))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    let availability: { startDate: string; endDate: string; nights: number; priceText?: string | null } | null = null;
    const startDate = typeof body.startDate === "string" ? body.startDate : "";
    const endDate = typeof body.endDate === "string" ? body.endDate : "";
    if (startDate || endDate) {
      const gap = (await listAvailability(db, 180)).find((item) => item.villa === body.villa && item.startDate === startDate && item.endDate === endDate);
      if (!gap) throw new Error("Seçilen müsaitlik artık geçerli değil.");
      const socialSettings = await getSocialSettings(db, body.villa);
      availability = { startDate: gap.startDate, endDate: gap.endDate, nights: gap.nights,
        priceText: socialSettings.includePrice ? await availabilityPriceText(db, body.villa, gap.startDate, gap.endDate) : null };
    }
    const result = await generateAiContent({ db, env, villa: body.villa, mode: body.mode, purpose: body.purpose,
      userBrief: typeof body.userBrief === "string" ? body.userBrief : "", availability,
      mediaCategory: typeof body.mediaCategory === "string" ? body.mediaCategory.slice(0, 80) : null,
      weekly: body.weekly === true });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "AI içerik üretilemedi." }, { status: 400 });
  }
}
