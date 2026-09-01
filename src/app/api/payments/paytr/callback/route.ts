import { parseNotificationForm, verifyNotificationHash } from "@/lib/payments/paytr/callback";
import { getPaymentByMerchantOid, markPaymentFailed, markPaymentPaid } from "@/lib/payments/db";
import { logPaymentAudit } from "@/lib/payments/audit";

export const dynamic = "force-dynamic";

function okResponse() {
  return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}

// Public - PayTR'ın server-to-server Bildirim URL hedefi. Admin auth YOK (provider callback'i).
// Hash doğrulanmadan HİÇBİR D1 state değişikliği yapılmaz. Ham form body/hash/secret asla loglanmaz -
// yalnız audit.ts'in izin verdiği güvenli alanlar.
export async function POST(request: Request) {
  const rawBody = await request.text();
  let form: URLSearchParams;
  try {
    form = new URLSearchParams(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const notification = parseNotificationForm(form);
  if (!notification) {
    return new Response("Bad Request", { status: 400 });
  }

  const hashValid = await verifyNotificationHash(notification);
  if (!hashValid) {
    await logPaymentAudit("PAYMENT_CALLBACK_HASH_INVALID", { paymentId: notification.merchantOid, status: notification.status });
    return new Response("Invalid hash", { status: 400 });
  }

  await logPaymentAudit("PAYMENT_CALLBACK_RECEIVED", { paymentId: notification.merchantOid, status: notification.status, amountMinor: notification.totalAmountMinor });

  const payment = await getPaymentByMerchantOid(notification.merchantOid);
  if (!payment) {
    // Hash kriptografik olarak geçerli (gerçekten PayTR'dan geliyor) ama bizde bu merchant_oid'e
    // ait bir kayıt yok - eski/bilinmeyen bir bildirim. Sonsuz retry'ı durdurmak için OK dönülür.
    await logPaymentAudit("PAYMENT_CALLBACK_UNKNOWN_OID", { paymentId: notification.merchantOid, status: notification.status });
    return okResponse();
  }

  if (payment.status === "paid") {
    // Idempotent: aynı başarılı callback tekrar geldi, no-op.
    await logPaymentAudit("PAYMENT_CALLBACK_DUPLICATE", { paymentId: payment.id, reservationId: payment.reservationId, villa: payment.villa, status: notification.status });
    return okResponse();
  }

  if (notification.status === "success") {
    await markPaymentPaid(payment.id, payment.reservationId, notification.totalAmountMinor);
    await logPaymentAudit("PAYMENT_PAID", {
      paymentId: payment.id,
      reservationId: payment.reservationId,
      villa: payment.villa,
      paymentType: payment.paymentType,
      amountMinor: notification.totalAmountMinor,
    });
  } else {
    const safeReason = notification.failedReasonMsg ? notification.failedReasonMsg.slice(0, 200) : "Ödeme başarısız.";
    await markPaymentFailed(payment.id, safeReason);
    await logPaymentAudit("PAYMENT_FAILED", { paymentId: payment.id, reservationId: payment.reservationId, villa: payment.villa, paymentType: payment.paymentType });
  }

  return okResponse();
}
