import { listScheduledInstagramPosts } from "@/lib/instagramSchedule";
import { listCampaigns, listMediaLibrary, socialOperationsDb } from "@/lib/socialOperationsDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { db } = await socialOperationsDb();
    const [campaigns, scheduled, media] = await Promise.all([
      listCampaigns(db, 500), listScheduledInstagramPosts(db), listMediaLibrary(db),
    ]);
    return Response.json({ campaigns, scheduled, media });
  } catch {
    return Response.json({ error: "İçerik takvimi yüklenemedi." }, { status: 500 });
  }
}
