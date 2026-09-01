import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "@/lib/types";
import type { Payment, PaymentStatus, PaymentType } from "./types";
import { generatePaymentId } from "./crypto";

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
  guest_email: string | null;
  no_installment: number;
  max_installment: number;
  token: string | null;
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
    guestEmail: row.guest_email,
    noInstallment: Boolean(row.no_installment),
    maxInstallment: row.max_installment,
    token: row.token,
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

const SELECT_WITH_RESERVATION = `
  SELECT p.*, r.villa AS villa, r.check_in AS check_in, r.check_out AS check_out
  FROM payments p
  JOIN reservations r ON r.id = p.reservation_id
`;

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

export async function setPaymentToken(id: string, token: string, expiresAt: string, guestEmail: string): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE payments SET token = ?, token_expires_at = ?, guest_email = ?, status = 'pending', updated_at = ?
    WHERE id = ?
  `).bind(token, expiresAt, guestEmail, now, id).run();
}

export async function markPaymentFailed(id: string, safeReason: string): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE payments SET status = 'failed', last_error = ?, failed_at = ?, updated_at = ? WHERE id = ?
  `).bind(safeReason, now, now, id).run();
}

export async function markPaymentPaid(id: string, reservationId: string, providerCustomerTotalMinor: number): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`
      UPDATE payments SET status = 'paid', provider_customer_total_minor = ?, paid_at = ?, updated_at = ? WHERE id = ?
    `).bind(providerCustomerTotalMinor, now, now, id),
  ]);

  // Mevcut admin görünümüyle tutarlılık için reservations.paid_amount da güncellenir (yan etki,
  // ama gerçek kaynak payments tablosudur - bkz. computeReservationPaymentSummary).
  const summary = await computeReservationPaymentSummary(reservationId);
  await db.prepare("UPDATE reservations SET paid_amount = ?, updated_at = ? WHERE id = ?")
    .bind(summary.paidTotalMinor / 100, now, reservationId).run();
}

export interface ReservationPaymentSummary {
  reservationTotalMinor: number;
  paidTotalMinor: number;
  remainingTotalMinor: number;
}

export async function computeReservationPaymentSummary(reservationId: string): Promise<ReservationPaymentSummary> {
  const db = await database();
  const reservation = await db.prepare("SELECT total_amount FROM reservations WHERE id = ?").bind(reservationId).first<{ total_amount: number }>();
  const reservationTotalMinor = Math.round((reservation?.total_amount ?? 0) * 100);
  const paidRow = await db.prepare("SELECT COALESCE(SUM(requested_amount_minor), 0) AS paid FROM payments WHERE reservation_id = ? AND status = 'paid'")
    .bind(reservationId).first<{ paid: number }>();
  const paidTotalMinor = paidRow?.paid ?? 0;
  return {
    reservationTotalMinor,
    paidTotalMinor,
    remainingTotalMinor: Math.max(0, reservationTotalMinor - paidTotalMinor),
  };
}
