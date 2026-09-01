import { z } from "zod";
import { findReservation } from "@/lib/db";
import { createPayment, listPaymentsForReservation, computeReservationPaymentSummary } from "@/lib/payments/db";
import { logPaymentAudit } from "@/lib/payments/audit";
import { isPaytrConfigured } from "@/lib/payments/paytr/config";
import { DEPOSIT_PERCENTAGE, FULL_PAYMENT_MAX_INSTALLMENT, PAYTR_TEST_MODE } from "@/lib/payments/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  reservationId: z.string().min(1),
  paymentType: z.enum(["deposit", "full_payment"]),
});

// admin.safiradestan.com'da adminAuthGate tarafından zaten korunuyor - bu route hiçbir public
// allowlist'e eklenmedi.
export async function GET(request: Request) {
  const reservationId = new URL(request.url).searchParams.get("reservationId");
  if (!reservationId) return Response.json({ error: "reservationId gerekli." }, { status: 400 });

  const [payments, summary, configured] = await Promise.all([
    listPaymentsForReservation(reservationId),
    computeReservationPaymentSummary(reservationId),
    isPaytrConfigured(),
  ]);
  return Response.json({ payments, summary, paytrConfigured: configured });
}

// Tutar HER ZAMAN reservations.total_amount'tan (backend) hesaplanır - istemciden hiçbir tutar
// kabul edilmez. Aşırı ödeme (overcharge) ve aynı anda birden fazla aktif deneme, PayTR
// yapılandırılmış olsa bile burada engellenir - test denemeleri bu korumaların dışında tutulur.
export async function POST(request: Request) {
  const configured = await isPaytrConfigured();
  if (!configured) {
    return Response.json({ error: "PayTR yapılandırılmadı." }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { reservationId, paymentType } = parsed.data;

  const reservation = await findReservation(reservationId);
  if (!reservation) {
    return Response.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
  }

  const testMode = PAYTR_TEST_MODE;

  const reservationTotalMinor = Math.round(reservation.totalAmount * 100);
  const requestedAmountMinor = paymentType === "deposit"
    ? Math.round((reservationTotalMinor * DEPOSIT_PERCENTAGE) / 100)
    : reservationTotalMinor;

  if (!testMode) {
    const summary = await computeReservationPaymentSummary(reservationId);
    if (summary.paidTotalMinor + requestedAmountMinor > summary.reservationTotalMinor) {
      await logPaymentAudit("PAYMENT_OVERCHARGE_BLOCKED", { reservationId, villa: reservation.villa, paymentType, amountMinor: requestedAmountMinor });
      return Response.json({ error: "Bu tutar rezervasyon toplamını aşıyor. Kalan bakiye ödeme akışı henüz aktif değil." }, { status: 409 });
    }
  }

  // Aynı rezervasyon için eşzamanlı ikinci aktif GERÇEK deneme, migration 0013'ün partial UNIQUE
  // index'i tarafından D1 seviyesinde engellenir (application-level "önce kontrol et" yerine) -
  // createPayment() bu durumda null döner. Test denemeleri bu kısıtın dışında (index yalnız
  // test_mode=0 satırlarını kapsıyor).
  const payment = await createPayment({
    reservationId,
    paymentType,
    reservationTotalMinor,
    requestedAmountMinor,
    noInstallment: paymentType === "deposit",
    maxInstallment: paymentType === "deposit" ? 0 : FULL_PAYMENT_MAX_INSTALLMENT,
    testMode,
  });

  if (!payment) {
    await logPaymentAudit("PAYMENT_ACTIVE_ATTEMPT_BLOCKED", { reservationId, villa: reservation.villa, paymentType });
    return Response.json({ error: "Bu rezervasyon için zaten aktif bir ödeme denemesi var." }, { status: 409 });
  }

  await logPaymentAudit("PAYMENT_CREATED", {
    paymentId: payment.id,
    reservationId,
    villa: reservation.villa,
    paymentType,
    amountMinor: requestedAmountMinor,
  });

  return Response.json({ paymentId: payment.id, checkoutUrl: `/odeme/${payment.id}` }, { status: 201 });
}
