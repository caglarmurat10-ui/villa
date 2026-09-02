import { listReservations } from "@/lib/db";
import { listExternalBlocksForAdmin } from "@/lib/ota/availability";

export const dynamic = "force-dynamic";

// OTA kaynaklı bloklar kesin rezervasyon DEĞİL - source+status (active/needs_review) açıkça
// taşınır, mobil taraf needs_review'ı "kesin" gibi göstermemeli (bkz. talimat).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const villa = url.searchParams.get("villa");

  const [reservations, otaBlocks] = await Promise.all([listReservations(), listExternalBlocksForAdmin()]);

  const villaFilter = (v: string) => villa === "Safira" || villa === "Destan" ? v === villa : true;

  return Response.json({
    reservations: reservations.filter((r) => villaFilter(r.villa)).map((r) => ({
      id: r.id,
      villa: r.villa,
      guestName: r.guestName,
      phone: r.phone,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      channel: r.channel,
      notes: r.notes,
      totalAmount: r.totalAmount,
      paidAmount: r.paidAmount,
      source: "direct" as const,
      confidence: "confirmed" as const,
    })),
    otaBlocks: otaBlocks.filter((b) => villaFilter(b.villa)).map((b) => ({
      villa: b.villa,
      checkIn: b.startDate,
      checkOut: b.endDate,
      source: b.source,
      confidence: b.status === "needs_review" ? "needs_review" as const : "confirmed" as const,
    })),
  });
}
