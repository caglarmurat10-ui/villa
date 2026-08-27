import { requireAiAdmin } from "@/lib/aiAdminSession";
import { hasAiAdminConfiguration, hasOpenAiConfiguration, integrationUnavailableResponse } from "@/lib/aiConfiguration";
import { publicAiError } from "@/lib/aiD1";
import { researchRegionalTopic } from "@/lib/aiContentStudio";
import { listRegionalIdeas } from "@/lib/aiDb";
import { socialOperationsDb } from "@/lib/socialOperationsDb";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";
const isVilla = (value: unknown): value is Villa => value === "Destan" || value === "Safira";
export async function GET(request: Request) {
  try {
    const { db, env } = await socialOperationsDb();
    if (!hasAiAdminConfiguration(env)) return integrationUnavailableResponse("admin");
    if (!(await requireAiAdmin(request, env))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    try {
      return Response.json({ configured: hasOpenAiConfiguration(env), items: await listRegionalIdeas(db), available: true, warnings: [] });
    } catch {
      return Response.json({ configured: hasOpenAiConfiguration(env), items: [], available: false,
        warnings: ["Bölgesel fikirler şu anda yüklenemedi. İçerik üretmeye devam edebilirsiniz."] });
    }
  } catch { return Response.json({ error: "Bölgesel içerik kuyruğu yüklenemedi." }, { status: 500 }); }
}
export async function POST(request: Request) {
  try {
    const { db, env } = await socialOperationsDb();
    if (!hasOpenAiConfiguration(env)) return integrationUnavailableResponse("openai");
    if (!hasAiAdminConfiguration(env)) return integrationUnavailableResponse("admin");
    const body = await request.json() as Record<string, unknown>;
    if (!isVilla(body.villa) || typeof body.topic !== "string") throw new Error("Araştırma bilgileri geçersiz.");
    if (!(await requireAiAdmin(request, env, true))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    const result = await researchRegionalTopic({ db, env, villa: body.villa, topic: body.topic,
      region: typeof body.region === "string" ? body.region : undefined, forceRefresh: body.forceRefresh === true });
    return Response.json(result, { status: result.cached ? 200 : 201 });
  } catch (error) {
    return Response.json({ error: publicAiError(error, "Bölgesel araştırma tamamlanamadı.") }, { status: 400 });
  }
}
