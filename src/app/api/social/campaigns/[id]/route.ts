import { getCampaign, socialOperationsDb, updateCampaignDraft } from "@/lib/socialOperationsDb";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const { db } = await socialOperationsDb();
  const campaign = await getCampaign(db, id);
  return campaign ? Response.json({ campaign }) : Response.json({ error: "Kampanya bulunamadı." }, { status: 404 });
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const { db } = await socialOperationsDb();
    const campaign = await updateCampaignDraft(db, id, {
      caption: typeof body.caption === "string" ? body.caption : undefined,
      mediaIds: Array.isArray(body.mediaIds) && body.mediaIds.every((item) => typeof item === "string") ? body.mediaIds : undefined,
      contentCategory: typeof body.contentCategory === "string" ? body.contentCategory : undefined,
    });
    return campaign ? Response.json({ campaign }) : Response.json({ error: "Taslak düzenlenemedi." }, { status: 409 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Taslak düzenlenemedi." }, { status: 400 });
  }
}
