import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "@/lib/types";
import type { Payment, PaymentStatus, PaymentType } from "./types";
import { generatePaymentId } from "./crypto";
import { EXPIRY_GRACE_MINUTES } from "./types";

interface PaymentRow {
  id: string;
  reservation_id: string;
  provider: "paytr";
  merchant_oid: string;
  payment_type: PaymentType;
  status: PaymentStatus;
  currency: "TRY";
  reservation_total_minor: number;
  requested_amount_minor: number;
  provider_customer_total_minor: number | null;
  provider_fee_minor: number | null;
  merchant_net_minor: number | null;
  no_installment: number;
  max_installment: number;
  token_expires_at: string | null;
  test_mode: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  failed_at: string | null;
  villa: Villa;
  check_in: string;
  check_out: string;
}

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

function mapRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    provider: row.provider,
    merchantOid: row.merchant_oid,
    paymentType: row.payment_type,
    status: row.status,
    currency: row.currency,
    reservationTotalMinor: row.reservation_total_minor,
    requestedAmountMinor: row.requested_amount_minor,
    providerCustomerTotalMinor: row.provider_customer_total_minor,
    providerFeeMinor: row.provider_fee_minor,
    merchantNetMinor: row.merchant_net_minor,
    noInstallment: Boolean(row.no_installment),
    maxInstallment: row.max_installment,
    tokenExpiresAt: row.token_expires_at,
    testMode: Boolean(row.test_mode),
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
    failedAt: row.failed_at,
    villa: row.villa,
    checkIn: row.check_in,
    checkOut: row.check_out,
  };
}

// guest_email/token kolonları D1'de hâlâ var (0012'den) ama artık burada seçilmiyor/okunmuyor -
// yeni kod bunları hiç yazmıyor (bkz. markPaymentPending), zamanla hepsi NULL kalacak.
const SELECT_WITH_RESERVATION = `
  SELECT
    p.id, p.reservation_id, p.provider, p.merchant_oid, p.payment_type, p.status, p.currency,
    p.reservation_total_minor, p.requested_amount_minor, p.provider_customer_total_minor,
    p.provider_fee_minor, p.merchant_net_minor, p.no_installment, p.max_installment,
    p.token_expires_at, p.test_mode, p.last_error, p.created_at, p.updated_at, p.paid_at, p.failed_at,
    r.villa AS villa, r.check_in AS check_in, r.check_out AS check_out
  FROM payments p
  JOIN reservations r ON r.id = p.reservation_id
`;

const TERMINAL_STATUSES: PaymentStatus[] = ["paid", "failed", "cancelled"];

export async function getPayment(id: string): Promise<Payment | null> {
  const db = await database();
  const row = await db.prepare(`${SELECT_WITH_RESERVATION} WHERE p.id = ?`).bind(id).first<PaymentRow>();
  return row ? mapRow(row) : null;
}

export async function getPaymentByMerchantOid(merchantOid: string): Promise<Payment | null> {
  const db = await database();
  const row = await db.prepare(`${SELECT_WITH_RESERVATION} WHERE p.merchant_oid = ?`).bind(merchantOid).first<PaymentRow>();
  return row ? mapRow(row) : null;
}

export async function listPaymentsForReservation(reservationId: string): Promise<Payment[]> {
  const db = await database();
  const result = await db.prepare(`${SELECT_WITH_RESERVATION} WHERE p.reservation_id = ? ORDER BY p.created_at DESC`).bind(reservationId).all<PaymentRow>();
  return result.results.map(mapRow);
}

// Bir reservation için "aktif" (henüz sonuçlanmamış) bir deneme var mı - yalnız GERÇEK (test_mode=0)
// denemeler sayılır, test denemeleri bu kontrolün dışında tutulur (aksi halde test sırasında ikinci
// bir deneme oluşturmak hep engellenir - bkz. AŞAMA raporu madde 8).
export async function hasActiveNonTestAttempt(reservationId: string): Promise<boolean> {
  const db = await database();
  const row = await db.prepare(
    "SELECT id FROM payments WHERE reservation_id = ? AND test_mode = 0 AND status IN ('created','pending') LIMIT 1",
  ).bind(reservationId).first();
  return Boolean(row);
}

export interface CreatePaymentInput {
  reservationId: string;
  paymentType: PaymentType;
  reservationTotalMinor: number;
  requestedAmountMinor: number;
  noInstallment: boolean;
  maxInstallment: number;
  testMode: boolean;
}

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const db = await database();
  const id = generatePaymentId();
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO payments (
      id, reservation_id, provider, merchant_oid, payment_type, status, currency,
      reservation_total_minor, requested_amount_minor, no_installment, max_installment,
      test_mode, created_at, updated_at
    ) VALUES (?, ?, 'paytr', ?, ?, 'created', 'TRY', ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, input.reservationId, id, input.paymentType,
    input.reservationTotalMinor, input.requestedAmountMinor,
    input.noInstallment ? 1 : 0, input.maxInstallment,
    input.testMode ? 1 : 0, now, now,
  ).run();

  const created = await getPayment(id);
  if (!created) throw new Error("Ödeme kaydı oluşturulamadı.");
  return created;
}

// Token'ın KENDİSİ D1'e hiç yazılmaz (yalnız PayTR yanıtı -> tarayıcı yanıtı akışında kullanılır) -
// burada yalnız durum + expiry saklanır.
export async function markPaymentPending(id: string, expiresAt: string): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.prepare("UPDATE payments SET token_expires_at = ?, status = 'pending', updated_at = ? WHERE id = ?")
    .bind(expiresAt, now, id).run();
}

export async function markPaymentFailed(id: string, safeReason: string): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE payments SET status = 'failed', last_error = ?, failed_at = ?, updated_at = ? WHERE id = ?
  `).bind(safeReason, now, now, id).run();
}

export async function markPaymentCancelled(id: string): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.prepare("UPDATE payments SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'pending'")
    .bind(now, id).run();
}

// pending + token_expires_at, tampon süreden daha eskiyse cancelled'a çevirir (lazy - cron değil).
// Yalnız 'pending' durumundaki kayıtlara dokunur; zaten terminal (paid/failed/cancelled) bir kayıt
// asla geriye döndürülmez. Tamponun amacı, sınırda gelen gerçek bir PayTR callback'iyle yarışmamak.
export async function maybeExpirePayment(payment: Payment): Promise<Payment> {
  if (payment.status !== "pending" || !payment.tokenExpiresAt) return payment;
  const expiresAtMs = Date.parse(payment.tokenExpiresAt);
  if (!Number.isFinite(expiresAtMs)) return payment;
  const graceMs = EXPIRY_GRACE_MINUTES * 60 * 1000;
  if (Date.now() < expiresAtMs + graceMs) return payment;

  await markPaymentCancelled(payment.id);
  const refreshed = await getPayment(payment.id);
  return refreshed ?? payment;
}

// Yalnız GERÇEK (test_mode=0) ödemede reservations.paid_amount güncellenir - test başarı callback'i
// gerçek finansı ASLA etkilemez.
export async function markPaymentPaid(payment: Payment, providerCustomerTotalMinor: number): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE payments SET status = 'paid', provider_customer_total_minor = ?, paid_at = ?, updated_at = ? WHERE id = ?
  `).bind(providerCustomerTotalMinor, now, now, payment.id).run();

  if (payment.testMode) return;

  const summary = await computeReservationPaymentSummary(payment.reservationId);
  await db.prepare("UPDATE reservations SET paid_amount = ?, updated_at = ? WHERE id = ?")
    .bind(summary.paidTotalMinor / 100, now, payment.reservationId).run();
}

export interface ReservationPaymentSummary {
  reservationTotalMinor: number;
  paidTotalMinor: number;
  remainingTotalMinor: number;
}

// Yalnız GERÇEK (test_mode=0) ve status='paid' ödemeler gerçek finans toplamına dahil edilir - test
// ödemeleri hiçbir zaman paid_total/remaining hesabını etkilemez.
export async function computeReservationPaymentSummary(reservationId: string): Promise<ReservationPaymentSummary> {
  const db = await database();
  const reservation = await db.prepare("SELECT total_amount FROM reservations WHERE id = ?").bind(reservationId).first<{ total_amount: number }>();
  const reservationTotalMinor = Math.round((reservation?.total_amount ?? 0) * 100);
  const paidRow = await db.prepare(
    "SELECT COALESCE(SUM(requested_amount_minor), 0) AS paid FROM payments WHERE reservation_id = ? AND status = 'paid' AND test_mode = 0",
  ).bind(reservationId).first<{ paid: number }>();
  const paidTotalMinor = paidRow?.paid ?? 0;
  return {
    reservationTotalMinor,
    paidTotalMinor,
    remainingTotalMinor: Math.max(0, reservationTotalMinor - paidTotalMinor),
  };
}

export function isTerminalStatus(status: PaymentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
