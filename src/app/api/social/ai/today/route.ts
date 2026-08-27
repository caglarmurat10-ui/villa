import { requireAiAdmin } from "@/lib/aiAdminSession";
import { todaySuggestion } from "@/lib/aiContentStudio";
import { socialOperationsDb } from "@/lib/socialOperationsDb";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, env } = await socialOperationsDb();
    if (!(await requireAiAdmin(request, env))) return Response.json({ error: "Yetkili oturum gerekli." }, { status: 401 });
    return Response.json({ items: await Promise.all((["Destan", "Safira"] as const).map((villa) => todaySuggestion(db, villa))) });
  } catch { return Response.json({ error: "Bugünün içerik önerileri hazırlanamadı." }, { status: 500 }); }
}
