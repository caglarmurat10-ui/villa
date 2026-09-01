import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "@/lib/types";

// Ödeme token'ı oluşturulmadan hemen önce çağrılır. Reservation zaten var (admin onayıyla
// oluşturulmuştu) - burada kontrol edilen, o tarihler için SONRADAN ortaya çıkmış bir çakışma
// var mı (ör. reservation onaylandıktan sonra gelen bir Airbnb/Booking rezervasyonu). Mevcut
// reservations D1-seviyesi overlap guard'ı zaten yeni direct kayıt çakışmasını engelliyor - burada
// asıl yeni risk external_blocks (OTA) tarafı.
export async function hasPaymentTimeConflict(villa: Villa, checkIn: string, checkOut: string, excludeReservationId: string): Promise<boolean> {
  const { env } = await getCloudflareContext({ async: true });
  const db: D1Database = env.DB;

  const otherReservation = await db.prepare(`
    SELECT id FROM reservations WHERE villa = ? AND id != ? AND deleted_at IS NULL AND check_in < ? AND check_out > ? LIMIT 1
  `).bind(villa, excludeReservationId, checkOut, checkIn).first();
  if (otherReservation) return true;

  const externalBlock = await db.prepare(`
    SELECT id FROM external_blocks WHERE villa = ? AND status IN ('active','needs_review') AND start_date < ? AND end_date > ? LIMIT 1
  `).bind(villa, checkOut, checkIn).first();
  return Boolean(externalBlock);
}
