import { listAvailability, socialOperationsDb, suggestLibraryMedia } from "@/lib/socialOperationsDb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const requested = Number(new URL(request.url).searchParams.get("days") ?? 90);
    const days = [30, 60, 90, 180].includes(requested) ? requested : 90;
    const { db } = await socialOperationsDb();
    const gaps = await listAvailability(db, days);
    const suggestions = new Map(
      await Promise.all((["Destan", "Safira"] as const).map(async (villa) =>
        [villa, await suggestLibraryMedia(db, villa)] as const)),
    );
    return Response.json({
      days,
      gaps: gaps.map((gap) => ({ ...gap, suggestedMedia: suggestions.get(gap.villa) ?? null })),
    });
  } catch {
    return Response.json({ error: "Müsaitlik bilgileri yüklenemedi." }, { status: 500 });
  }
}
