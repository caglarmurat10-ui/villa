import { requireAiAdmin } from "@/lib/aiAdminSession";
import { hasAiAdminConfiguration, hasOpenAiConfiguration, integrationUnavailableResponse } from "@/lib/aiConfiguration";
import { generateAiIllustration, videoGenerationStatus } from "@/lib/openaiImage";
import { socialOperationsDb } from "@/lib/socialOperationsDb";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";
const isVilla = (value: unknown): value is Villa => value === "Destan" || value === "Safira";
export async function GET(request: Request) {
  try {
    const { db, env } = await socialOperationsDb();
    if (!hasOpenAiConfiguration(env)) return integrationUnavailableResponse("openai");
    if (!hasAiAdminConfiguration(env)) return integrationUnavailableResponse("admin");
    const villa = new URL(request.url).searchParams.get("villa"); if (!isVilla(villa)) throw new Error("Villa seçimi geçersiz.");
    if (!(await requireAiAdmin(request, env))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    return Response.json({ video: await videoGenerationStatus(db, env, villa) });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "AI medya durumu alınamadı." }, { status: 400 }); }
}
export async function POST(request: Request) {
  try {
    const { db, env } = await socialOperationsDb();
    if (!hasOpenAiConfiguration(env)) return integrationUnavailableResponse("openai");
    if (!hasAiAdminConfiguration(env)) return integrationUnavailableResponse("admin");
    const body = await request.json() as Record<string, unknown>; if (!isVilla(body.villa) || typeof body.prompt !== "string") throw new Error("AI görsel bilgileri geçersiz.");
    if (!(await requireAiAdmin(request, env, true))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    return Response.json({ item: await generateAiIllustration({ db, env, villa: body.villa, prompt: body.prompt }) }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "AI görseli oluşturulamadı." }, { status: 400 }); }
}
