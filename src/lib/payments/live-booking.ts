import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import { generatePaymentId } from "./crypto";
import { FULL_PAYMENT_MAX_INSTALLMENT, type Payment } from "./types";

// Public canlı ödeme için ilk form submit'inden PayTR iframe'inin başlamasına kadar yeterli tampon.
// Checkout token alındığında süre ayrıca PayTR timeout + grace süresine uzatılır.
const INITIAL_HOLD_MINUTES = 45;

interface ActivePaymentRow {
  id: string;
  status: "created" | "pending";
}

interface LiveBookingContext {
  inquiry_id: string;
  guest_name: string;
  phone: string;
  villa: "Safira" | "Destan";
  check_in: string;
  check_out: string;
  guest_count: number;
  note: string;
  quoted_nights: number;
}

export type LivePaymentStartResult =
  | { ok: true; paymentId: string; status: "created" | "pending"; reused: boolean }
  | { ok: false; message: string };

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

function changed(result: { meta?: { changes?: number } } | undefined): boolean {
  return (result?.meta?.changes ?? 0) === 1;
}

async function releaseExpiredLiveHolds(db: D1Database, now: string): Promise<void> {
  await db.batch([
    db.prepare(`UPDATE payments
      SET status = 'cancelled', updated_at = ?
      WHERE test_mode = 0 AND status IN ('created', 'pending')
        AND id IN (
          SELECT payment_id FROM booking_payment_holds
          WHERE status = 'active' AND expires_at <= ?
        )`).bind(now, now),
    db.prepare(`UPDATE booking_payment_holds
      SET status = 'released', updated_at = ?
      WHERE status = 'active' AND expires_at <= ?`).bind(now, now),
  ]);
}

async function findReusableLivePayment(db: D1Database, inquiryId: string, now: string): Promise<ActivePaymentRow | null> {
  return db.prepare(`SELECT p.id, p.status
    FROM payments p
    JOIN booking_payment_holds h ON h.payment_id = p.id
    WHERE p.reservation_id = ?
      AND p.test_mode = 0
      AND p.status IN ('created', 'pending')
      AND h.status = 'active'
      AND h.expires_at > ?
    ORDER BY p.created_at DESC
    LIMIT 1`).bind(inquiryId, now).first<ActivePaymentRow>();
}

export async function createLivePaymentForInquiry(inquiryId: string, totalMinor: number): Promise<LivePaymentStartResult> {
  if (!Number.isInteger(totalMinor) || totalMinor <= 0) {
    return { ok: false, message: "Ödeme tutarı doğrulanamadı." };
  }

  const db = await database();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const expiresAt = new Date(nowDate.getTime() + INITIAL_HOLD_MINUTES * 60 * 1000).toISOString();

  await releaseExpiredLiveHolds(db, now);

  const reusable = await findReusableLivePayment(db, inquiryId, now);
  if (reusable) {
    return { ok: true, paymentId: reusable.id, status: reusable.status, reused: true };
  }

  const holdId = crypto.randomUUID();
  const paymentId = generatePaymentId();

  try {
    const results = await db.batch([
      db.prepare(`INSERT INTO booking_payment_holds
        (id, inquiry_id, payment_id, villa, check_in, check_out, status, expires_at, created_at, updated_at)
        SELECT ?, bi.id, ?, bi.villa, bi.check_in, bi.check_out, 'active', ?, ?, ?
        FROM booking_inquiries bi
        WHERE bi.id = ?
          AND bi.converted_reservation_id IS NULL
          AND bi.status != 'Kapatıldı'
          AND bi.quoted_total IS NOT NULL
          AND CAST(ROUND(bi.quoted_total * 100) AS INTEGER) = ?
          AND NOT EXISTS (
            SELECT 1 FROM reservations r
            WHERE r.villa = bi.villa
              AND r.deleted_at IS NULL
              AND r.check_in < bi.check_out
              AND r.check_out > bi.check_in
          )
          AND NOT EXISTS (
            SELECT 1 FROM external_blocks e
            WHERE e.villa = bi.villa
              AND e.status IN ('active', 'needs_review')
              AND e.start_date < bi.check_out
              AND e.end_date > bi.check_in
          )
          AND NOT EXISTS (
            SELECT 1 FROM booking_payment_holds h
            WHERE h.status = 'active'
              AND h.expires_at > ?
              AND h.villa = bi.villa
              AND h.check_in < bi.check_out
              AND h.check_out > bi.check_in
          )`)
        .bind(holdId, paymentId, expiresAt, now, now, inquiryId, totalMinor, now),
      db.prepare(`INSERT INTO payments (
          id, reservation_id, provider, merchant_oid, payment_type, status, currency,
          reservation_total_minor, requested_amount_minor, no_installment, max_installment,
          test_mode, created_at, updated_at
        )
        SELECT ?, h.inquiry_id, 'paytr', ?, 'full_payment', 'created', 'TRY', ?, ?, 0, ?, 0, ?, ?
        FROM booking_payment_holds h
        WHERE h.id = ? AND h.payment_id = ? AND h.status = 'active'`)
        .bind(paymentId, paymentId, totalMinor, totalMinor, FULL_PAYMENT_MAX_INSTALLMENT, now, now, holdId, paymentId),
    ]);

    if (!changed(results[0]) || !changed(results[1])) {
      return {
        ok: false,
        message: "Bu tarihler şu anda başka bir rezervasyon veya ödeme işlemi nedeniyle kullanılamıyor. Lütfen farklı tarih seçin ya da birkaç dakika sonra tekrar deneyin.",
      };
    }

    return { ok: true, paymentId, status: "created", reused: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint/i.test(message)) {
      const existing = await findReusableLivePayment(db, inquiryId, new Date().toISOString());
      if (existing) {
        return { ok: true, paymentId: existing.id, status: existing.status, reused: true };
      }
      return {
        ok: false,
        message: "Bu rezervasyon için başka bir ödeme işlemi zaten başlatılmış.",
      };
    }
    throw error;
  }
}

export async function hasValidLivePaymentHold(payment: Payment): Promise<boolean> {
  if (payment.testMode) return true;
  const db = await database();
  const now = new Date().toISOString();
  await releaseExpiredLiveHolds(db, now);
  const row = await db.prepare(`SELECT id FROM booking_payment_holds
    WHERE payment_id = ?
      AND inquiry_id = ?
      AND status = 'active'
      AND expires_at > ?
    LIMIT 1`).bind(payment.id, payment.reservationId, now).first<{ id: string }>();
  return Boolean(row);
}

export async function extendLivePaymentHold(paymentId: string, expiresAt: string): Promise<boolean> {
  const db = await database();
  const now = new Date().toISOString();
  const result = await db.prepare(`UPDATE booking_payment_holds
    SET expires_at = ?, updated_at = ?
    WHERE payment_id = ? AND status = 'active'`).bind(expiresAt, now, paymentId).run();
  return changed(result);
}

export async function releaseLivePaymentHold(paymentId: string): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.prepare(`UPDATE booking_payment_holds
    SET status = 'released', updated_at = ?
    WHERE payment_id = ? AND status IN ('active', 'finalizing')`).bind(now, paymentId).run();
}

export async function finalizeLiveBookingPayment(
  payment: Payment,
  providerCustomerTotalMinor: number,
): Promise<{ reservationId: string; alreadyFinalized: boolean }> {
  if (payment.testMode) {
    throw new Error("Test payment cannot use live booking finalization.");
  }

  const db = await database();
  const context = await db.prepare(`SELECT
      bi.id AS inquiry_id,
      bi.guest_name,
      bi.phone,
      bi.villa,
      bi.check_in,
      bi.check_out,
      bi.guest_count,
      bi.note,
      bi.quoted_nights
    FROM booking_payment_holds h
    JOIN booking_inquiries bi ON bi.id = h.inquiry_id
    JOIN payments p ON p.id = h.payment_id
    WHERE h.payment_id = ?
      AND h.inquiry_id = ?
      AND h.status = 'active'
      AND p.status = 'pending'
      AND p.test_mode = 0
      AND p.reservation_id = bi.id
      AND bi.converted_reservation_id IS NULL
      AND bi.status != 'Kapatıldı'
    LIMIT 1`).bind(payment.id, payment.reservationId).first<LiveBookingContext>();

  if (!context || context.quoted_nights <= 0) {
    const current = await db.prepare("SELECT status, reservation_id FROM payments WHERE id = ?")
      .bind(payment.id).first<{ status: string; reservation_id: string }>();
    if (current?.status === "paid" && current.reservation_id !== payment.reservationId) {
      return { reservationId: current.reservation_id, alreadyFinalized: true };
    }
    throw new Error("Canlı ödeme rezervasyon kilidi doğrulanamadı.");
  }

  const reservationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const totalAmount = payment.reservationTotalMinor / 100;
  const paidAmount = payment.requestedAmountMinor / 100;
  const nightlyRate = totalAmount / context.quoted_nights;
  const notes = [
    `Web rezervasyon ödemesiyle otomatik oluşturuldu · ${context.guest_count} kişi`,
    context.note ? `Misafir notu: ${context.note}` : "",
  ].filter(Boolean).join("\n");
  const reservationPayload = {
    id: reservationId,
    villa: context.villa,
    guestName: context.guest_name,
    phone: context.phone,
    checkIn: context.check_in,
    checkOut: context.check_out,
    channel: "Doğrudan",
    nightlyRate,
    totalAmount,
    paidAmount,
    notes,
    createdAt: now,
    updatedAt: now,
  };

  const results = await db.batch([
    db.prepare(`UPDATE booking_payment_holds
      SET status = 'finalizing', updated_at = ?
      WHERE payment_id = ? AND status = 'active'
        AND EXISTS (
          SELECT 1
          FROM payments p
          JOIN booking_inquiries bi ON bi.id = p.reservation_id
          WHERE p.id = ?
            AND p.status = 'pending'
            AND p.test_mode = 0
            AND bi.id = booking_payment_holds.inquiry_id
            AND bi.converted_reservation_id IS NULL
            AND bi.status != 'Kapatıldı'
        )`).bind(now, payment.id, payment.id),
    db.prepare(`INSERT INTO reservations
      (id, villa, guest_name, phone, check_in, check_out, channel, nightly_rate, total_amount, paid_amount, notes, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, 'Doğrudan', ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1
        FROM booking_payment_holds h
        JOIN payments p ON p.id = h.payment_id
        JOIN booking_inquiries bi ON bi.id = h.inquiry_id
        WHERE h.payment_id = ?
          AND h.status = 'finalizing'
          AND p.status = 'pending'
          AND p.test_mode = 0
          AND p.reservation_id = bi.id
          AND bi.converted_reservation_id IS NULL
          AND bi.status != 'Kapatıldı'
      )`).bind(
        reservationId,
        context.villa,
        context.guest_name,
        context.phone,
        context.check_in,
        context.check_out,
        nightlyRate,
        totalAmount,
        paidAmount,
        notes,
        now,
        now,
        payment.id,
      ),
    db.prepare(`UPDATE payments
      SET status = 'paid', provider_customer_total_minor = ?, reservation_id = ?, paid_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending' AND test_mode = 0
        AND EXISTS (SELECT 1 FROM reservations WHERE id = ?)`)
      .bind(providerCustomerTotalMinor, reservationId, now, now, payment.id, reservationId),
    db.prepare(`UPDATE booking_inquiries
      SET status = 'Kapatıldı', converted_reservation_id = ?, converted_at = ?, updated_at = ?
      WHERE id = ? AND converted_reservation_id IS NULL
        AND EXISTS (
          SELECT 1 FROM payments
          WHERE id = ? AND status = 'paid' AND reservation_id = ?
        )`).bind(reservationId, now, now, context.inquiry_id, payment.id, reservationId),
    db.prepare(`UPDATE booking_payment_holds
      SET status = 'paid', updated_at = ?
      WHERE payment_id = ? AND status = 'finalizing'
        AND EXISTS (
          SELECT 1 FROM payments
          WHERE id = ? AND status = 'paid' AND reservation_id = ?
        )`).bind(now, payment.id, payment.id, reservationId),
    db.prepare(`INSERT INTO audit_log (entity_id, action, payload, created_at)
      SELECT ?, 'CREATE', ?, ?
      WHERE EXISTS (SELECT 1 FROM reservations WHERE id = ?)`)
      .bind(reservationId, JSON.stringify(reservationPayload), now, reservationId),
    db.prepare(`INSERT INTO audit_log (entity_id, action, payload, created_at)
      SELECT ?, 'INQUIRY_CONVERT', ?, ?
      WHERE EXISTS (
        SELECT 1 FROM booking_inquiries
        WHERE id = ? AND converted_reservation_id = ?
      )`).bind(context.inquiry_id, JSON.stringify({ reservationId, paymentId: payment.id }), now, context.inquiry_id, reservationId),
  ]);

  if (changed(results[0]) && changed(results[1]) && changed(results[2]) && changed(results[3]) && changed(results[4])) {
    return { reservationId, alreadyFinalized: false };
  }

  const current = await db.prepare("SELECT status, reservation_id FROM payments WHERE id = ?")
    .bind(payment.id).first<{ status: string; reservation_id: string }>();
  if (current?.status === "paid" && current.reservation_id !== payment.reservationId) {
    return { reservationId: current.reservation_id, alreadyFinalized: true };
  }

  throw new Error("Canlı ödeme rezervasyona dönüştürülemedi; PayTR bildirimi tekrar denenecek.");
}
