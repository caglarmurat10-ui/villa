import { requireAiAdmin } from "@/lib/aiAdminSession";
import { aiConfigurationStatus, hasAiAdminConfiguration, integrationUnavailableResponse } from "@/lib/aiConfiguration";
import { todaySuggestion } from "@/lib/aiContentStudio";
import { socialOperationsDb } from "@/lib/socialOperationsDb";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, env } = await socialOperationsDb();
    if (!hasAiAdminConfiguration(env)) return integrationUnavailableResponse("admin");
    if (!(await requireAiAdmin(request, env))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    const items = await Promise.all((["Destan", "Safira"] as const).map((villa) => todaySuggestion(db, villa)));
    const configuration = aiConfigurationStatus(env, items.some((item) => item.enabled && item.autopilotLevel !== "off"));
    return Response.json({ configured: configuration.openAiConfigured, configuration, items });
  } catch { return Response.json({ error: "Bugünün içerik önerileri hazırlanamadı." }, { status: 500 }); }
}
