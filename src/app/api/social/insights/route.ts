import { getInsightsDashboard } from "@/lib/instagramInsights";
import { socialOperationsDb } from "@/lib/socialOperationsDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { db } = await socialOperationsDb();
    return Response.json(await getInsightsDashboard(db));
  } catch {
    return Response.json({ error: "Instagram istatistikleri yüklenemedi." }, { status: 500 });
  }
}
