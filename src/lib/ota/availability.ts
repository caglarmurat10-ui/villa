import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "@/lib/types";
import type { AdminExternalBlock } from "./types";

// Yalnız admin tarafı için: kaynak (airbnb/booking/manual) burada VAR - public listBlockedRanges()
// ise bilerek kaynağı hiç döndürmüyor. Bu ayrım veri katmanında zorlanıyor (iki farklı fonksiyon),
// tek bir fonksiyonun render'da filtrelenmesine güvenilmiyor.
export async function listExternalBlocksForAdmin(): Promise<AdminExternalBlock[]> {
  const { env } = await getCloudflareContext({ async: true });
  const db: D1Database = env.DB;
  const result = await db.prepare(
    "SELECT villa, source, start_date, end_date, status FROM external_blocks WHERE status IN ('active','needs_review') ORDER BY start_date ASC",
  ).all<{ villa: Villa; source: AdminExternalBlock["source"]; start_date: string; end_date: string; status: AdminExternalBlock["status"] }>();
  return result.results.map((row) => ({ villa: row.villa, source: row.source, startDate: row.start_date, endDate: row.end_date, status: row.status }));
}

export interface BlockedRange {
  villa: Villa;
  checkIn: string;
  checkOut: string;
}

// active + needs_review ikisi de public takvimde "müsait değil" gösterilir - needs_review zaten
// potansiyel bir çakışma olduğu için gösterilmemesi daha yanlış olurdu. Kaynak (airbnb/booking/
// manual) BİLEREK dönmüyor - public tarafa hiçbir zaman sızmamalı, yalnız {villa, checkIn, checkOut}
// - mevcut reservation listesiyle birebir aynı şekle sahip, PublicBookingWidget/
// VillaAvailabilityCalendar hiç değişmeden bu satırları da normal bir rezervasyon gibi işler.
export async function listBlockedRanges(): Promise<BlockedRange[]> {
  const { env } = await getCloudflareContext({ async: true });
  const db: D1Database = env.DB;
  const result = await db.prepare(
    "SELECT villa, start_date, end_date FROM external_blocks WHERE status IN ('active','needs_review')",
  ).all<{ villa: Villa; start_date: string; end_date: string }>();
  return result.results.map((row) => ({ villa: row.villa, checkIn: row.start_date, checkOut: row.end_date }));
}
