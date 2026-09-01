import { getCloudflareContext } from "@opennextjs/cloudflare";

export type PaymentAuditAction =
  | "PAYMENT_CREATED"
  | "PAYMENT_TOKEN_ISSUED"
  | "PAYMENT_TOKEN_FAILED"
  | "PAYMENT_CONFLICT_BLOCKED"
  | "PAYMENT_TEST_CONFLICT_BYPASSED"
  | "PAYMENT_CALLBACK_RECEIVED"
  | "PAYMENT_CALLBACK_HASH_INVALID"
  | "PAYMENT_CALLBACK_UNKNOWN_OID"
  | "PAYMENT_CALLBACK_DUPLICATE"
  | "PAYMENT_CALLBACK_TERMINAL_IGNORED"
  | "PAYMENT_CALLBACK_AMOUNT_MISMATCH"
  | "PAYMENT_PAID"
  | "PAYMENT_FAILED"
  | "PAYMENT_EXPIRED"
  | "PAYMENT_RETRY_BLOCKED"
  | "PAYMENT_ACTIVE_ATTEMPT_BLOCKED"
  | "PAYMENT_OVERCHARGE_BLOCKED";

interface PaymentAuditPayload {
  paymentId?: string;
  reservationId?: string;
  villa?: string;
  paymentType?: string;
  status?: string;
  amountMinor?: number;
}

// Yalnız güvenli metadata: payment/reservation id, villa, tip, durum, tutar. E-posta/telefon/kart/
// hash/token/merchant_key/merchant_salt/ham callback body ASLA bu fonksiyona geçirilmemeli.
export async function logPaymentAudit(action: PaymentAuditAction, payload: PaymentAuditPayload): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  await env.DB.prepare(
    "INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, ?, ?, ?)",
  ).bind(payload.paymentId ?? payload.reservationId ?? "payment", action, JSON.stringify(payload), new Date().toISOString()).run();
}
