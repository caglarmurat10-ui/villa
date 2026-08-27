import { requireAiAdmin } from "@/lib/aiAdminSession";
import { aiConfigurationStatus, hasAiAdminConfiguration, integrationUnavailableResponse } from "@/lib/aiConfiguration";
import { aiUsageSummary, getAiSettings, getVillaAiProfile, saveAiSettings, saveVillaAiProfile,
  type AiSocialSettings } from "@/lib/aiDb";
import type { VillaAiProfile } from "@/lib/aiTypes";
import { socialOperationsDb } from "@/lib/socialOperationsDb";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";
const villas = ["Destan", "Safira"] as const;
const isVilla = (value: unknown): value is Villa => value === "Destan" || value === "Safira";

export async function GET(request: Request) {
  try {
    const { db, env } = await socialOperationsDb();
    if (!hasAiAdminConfiguration(env)) return integrationUnavailableResponse("admin");
    if (!(await requireAiAdmin(request, env))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    const baseItems = await Promise.all(villas.map(async (villa) => ({ settings: await getAiSettings(db, villa),
      profile: await getVillaAiProfile(db, villa) })));
    const configuration = aiConfigurationStatus(env, baseItems.some((item) => item.settings.aiEnabled && item.settings.autopilotLevel !== "off"));
    const items = baseItems.map((item) => ({ ...item,
      systemFlags: { image: configuration.imageEnabled, video: configuration.videoEnabled } }));
    return Response.json({ configured: true, configuration, items, usage: await aiUsageSummary(db) });
  } catch { return Response.json({ error: "AI ayarları yüklenemedi." }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const { db, env } = await socialOperationsDb();
    if (!hasAiAdminConfiguration(env)) return integrationUnavailableResponse("admin");
    if (!(await requireAiAdmin(request, env, true))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    const body = await request.json() as { settings?: AiSocialSettings; profile?: VillaAiProfile };
    if (!body.settings || !body.profile || !isVilla(body.settings.villa) || body.profile.villa !== body.settings.villa ||
      !Array.isArray(body.profile.facts) || !Array.isArray(body.profile.prohibitedClaims)) throw new Error("AI villa ayarları geçersiz.");
    return Response.json({ settings: await saveAiSettings(db, body.settings), profile: await saveVillaAiProfile(db, body.profile) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "AI ayarları kaydedilemedi." }, { status: 400 });
  }
}
