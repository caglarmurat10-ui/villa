import { z } from "zod";
import { findReservation } from "@/lib/db";
import { getPayment, setPaymentToken, markPaymentFailed } from "@/lib/payments/db";
import { hasPaymentTimeConflict } from "@/lib/payments/availability";
import { requestPaytrToken } from "@/lib/payments/paytr/token";
import { logPaymentAudit } from "@/lib/payments/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  paymentId: z.string().min(1),
  email: z.string().email().max(100),
});

const ORIGIN = "https://safiradestan.com";

// Public - müşterinin kendi "Güvenli Ödemeye Geç" tıklamasıyla tetiklenir. Bu isteğin KENDİSİ
// müşterinin gerçek IP'sini taşır (PayTR'ın zorunlu user_ip alanı için doğru kaynak - admin'in
// "Ödeme Oluştur" anında değil).
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }
  const { paymentId, email } = parsed.data;

  const payment = await getPayment(paymentId);
  if (!payment) {
    return Response.json({ ok: false, error: "Ödeme bulunamadı." }, { status: 404 });
  }
  if (payment.status === "paid") {
    return Response.json({ ok: false, error: "Bu ödeme zaten tamamlandı." }, { status: 409 });
  }

  const conflict = await hasPaymentTimeConflict(payment.villa, payment.checkIn, payment.checkOut, payment.reservationId);
  if (conflict) {
    await logPaymentAudit("PAYMENT_CONFLICT_BLOCKED", { paymentId, reservationId: payment.reservationId, villa: payment.villa });
    return Response.json({ ok: false, error: "Bu tarihler için müsaitlik durumu değişti. Lütfen bizimle iletişime geçin." }, { status: 409 });
  }

  const reservation = await findReservation(payment.reservationId);
  const userIp = request.headers.get("cf-connecting-ip") ?? "0.0.0.0";

  const result = await requestPaytrToken({
    merchantOid: payment.merchantOid,
    userIp,
    email,
    amountMinor: payment.requestedAmountMinor,
    villaName: `Villa ${payment.villa}`,
    paymentType: payment.paymentType,
    noInstallment: payment.noInstallment,
    maxInstallment: payment.maxInstallment,
    userName: reservation?.guestName ?? "Misafir",
    userPhone: reservation?.phone ?? "",
    okUrl: `${ORIGIN}/odeme/${paymentId}/basarili`,
    failUrl: `${ORIGIN}/odeme/${paymentId}/basarisiz`,
    testMode: payment.testMode,
  });

  if (!result.ok || !result.token || !result.iframeUrl || !result.expiresAt) {
    await markPaymentFailed(paymentId, result.error ?? "Token alınamadı.");
    await logPaymentAudit("PAYMENT_TOKEN_FAILED", { paymentId, reservationId: payment.reservationId, villa: payment.villa });
    return Response.json({ ok: false, error: result.error ?? "Ödeme oturumu başlatılamadı." }, { status: 502 });
  }

  await setPaymentToken(paymentId, result.token, result.expiresAt, email);
  await logPaymentAudit("PAYMENT_TOKEN_ISSUED", { paymentId, reservationId: payment.reservationId, villa: payment.villa, amountMinor: payment.requestedAmountMinor });

  return Response.json({ ok: true, iframeUrl: result.iframeUrl });
}
