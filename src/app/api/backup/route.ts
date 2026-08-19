import { getAuditLog, getCommissionRate, listPriceRanges, listReservations } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [commissionRate, prices, reservations, auditLog] = await Promise.all([
    getCommissionRate(), listPriceRanges(), listReservations(), getAuditLog(),
  ]);
  const body = JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), commissionRate, prices, reservations, auditLog }, null, 2);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="villa-yedek-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
