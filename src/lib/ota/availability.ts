import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "@/lib/types";
import type { AdminExternalBlock } from "./types";

function safeOtaReadError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 240) : "unknown";
}

// Yalnız admin tarafı için: kaynak (airbnb/booking/manual) burada VAR - public listBlockedRanges()
// ise bilerek kaynağı hiç döndürmüyor. OTA blokları çekirdek rezervasyon verisine yardımcı katmandır;
// tablo/migration/KV kaynaklı bir OTA okuma hatası tüm admin takvimini düşürmemeli.
export async function listExternalBlocksForAdmin(): Promise<AdminExternalBlock[]> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db: D1Database = env.DB;
    const result = await db.prepare(
      "SELECT villa, source, start_date, end_date, status FROM external_blocks WHERE status IN ('active','needs_review') ORDER BY start_date ASC",
    ).all<{ villa: Villa; source: AdminExternalBlock["source"]; start_date: string; end_date: string; status: AdminExternalBlock["status"] }>();
    return result.results.map((row) => ({ villa: row.villa, source: row.source, startDate: row.start_date, endDate: row.end_date, status: row.status }));
  } catch (error) {
    console.error(`[OTA Availability] admin external_blocks read failed: ${safeOtaReadError(error)}`);
    return [];
  }
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
// OTA okuması başarısız olursa public villa sayfası yine gerçek yönetim rezervasyonlarıyla açılır;
// hata loglanır ve OTA blokları geçici olarak boş kabul edilir.
export async function listBlockedRanges(): Promise<BlockedRange[]> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db: D1Database = env.DB;
    const result = await db.prepare(
      "SELECT villa, start_date, end_date FROM external_blocks WHERE status IN ('active','needs_review')",
    ).all<{ villa: Villa; start_date: string; end_date: string }>();
    return result.results.map((row) => ({ villa: row.villa, checkIn: row.start_date, checkOut: row.end_date }));
  } catch (error) {
    console.error(`[OTA Availability] public external_blocks read failed: ${safeOtaReadError(error)}`);
    return [];
  }
}
