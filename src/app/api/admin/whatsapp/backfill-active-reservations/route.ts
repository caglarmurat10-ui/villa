import { listReservations } from "@/lib/db";
import { syncCheckoutReminderForReservation } from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

// Bu özellik devreye alınmadan ÖNCE oluşturulmuş, hâlâ aktif rezervasyonlar için tek seferlik
// (ama tekrar çalıştırılması tamamen güvenli - syncCheckoutReminderForReservation idempotent)
// arka dolgu. Round 4 talebindeki "her aktif rezervasyon için" (yalnız bundan sonra oluşturulanlar
// değil) maddesini karşılar. custom-worker.mjs'teki günlük KV guard (runWhatsappBackfillIfDue) ile
// - diğer günlük cron'larla (social planner, public scout, GBP) AYNI desende - günde bir kez
// tetiklenir; elle tekrar çağrılması da (ör. admin panelinden) zarar vermez.
export async function POST() {
  const today = istanbulToday();
  const reservations = await listReservations();
  const active = reservations.filter((r) => r.checkOut >= today);

  let synced = 0;
  let errors = 0;
  for (const reservation of active) {
    try {
      await syncCheckoutReminderForReservation({ id: reservation.id, checkOut: reservation.checkOut, phone: reservation.phone });
      synced += 1;
    } catch (error) {
      errors += 1;
      console.error(`[WhatsApp Backfill] reservation=${reservation.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return Response.json({ activeReservationCount: active.length, synced, errors });
}
