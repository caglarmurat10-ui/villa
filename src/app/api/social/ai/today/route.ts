import { requireAiAdmin } from "@/lib/aiAdminSession";
import { aiConfigurationStatus, hasAiAdminConfiguration, integrationUnavailableResponse } from "@/lib/aiConfiguration";
import { fallbackTodaySuggestion, todaySuggestion } from "@/lib/aiContentStudio";
import { socialOperationsDb } from "@/lib/socialOperationsDb";

export const dynamic = "force-dynamic";
const villas = ["Destan", "Safira"] as const;
export async function GET(request: Request) {
  try {
    const { db, env } = await socialOperationsDb();
    if (!hasAiAdminConfiguration(env)) return integrationUnavailableResponse("admin");
    if (!(await requireAiAdmin(request, env))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    const settled = await Promise.allSettled(villas.map((villa) => todaySuggestion(db, villa)));
    const items = settled.map((result, index) => result.status === "fulfilled" ? result.value : fallbackTodaySuggestion(villas[index]));
    const configuration = aiConfigurationStatus(env, items.some((item) => item.enabled && item.autopilotLevel !== "off"));
    const available = settled.every((result) => result.status === "fulfilled") && items.every((item) => item.historyAvailable);
    return Response.json({ configured: configuration.aiEnabled, configuration, items, available,
      warnings: available ? [] : ["İçerik geçmişi şu anda yüklenemedi. İçerik üretmeye devam edebilirsiniz."] });
  } catch { return Response.json({ error: "Bugünün içerik önerileri hazırlanamadı." }, { status: 500 }); }
}
