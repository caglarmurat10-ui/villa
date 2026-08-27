import {
  getBrandProfile,
  getSocialSettings,
  saveBrandProfile,
  saveSocialSettings,
  socialOperationsDb,
  type SocialBrandProfile,
  type SocialVillaSettings,
} from "@/lib/socialOperationsDb";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";
const villas = ["Destan", "Safira"] as const;
const isVilla = (value: unknown): value is Villa => value === "Destan" || value === "Safira";

export async function GET() {
  try {
    const { db } = await socialOperationsDb();
    const items = await Promise.all(villas.map(async (villa) => ({
      settings: await getSocialSettings(db, villa),
      brand: await getBrandProfile(db, villa),
    })));
    return Response.json({ items });
  } catch {
    return Response.json({ error: "Sosyal medya ayarları yüklenemedi." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { settings?: SocialVillaSettings; brand?: SocialBrandProfile };
    if (!body.settings || !body.brand || !isVilla(body.settings.villa) || body.brand.villa !== body.settings.villa) {
      throw new Error("Villa ayarları geçersiz.");
    }
    const { db } = await socialOperationsDb();
    const [settings, brand] = await Promise.all([
      saveSocialSettings(db, body.settings), saveBrandProfile(db, body.brand),
    ]);
    return Response.json({ settings, brand });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Ayarlar kaydedilemedi." }, { status: 400 });
  }
}
