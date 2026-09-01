import { z } from "zod";
import { getPayment, markPaymentPending, markPaymentFailed, maybeExpirePayment } from "@/lib/payments/db";
import { hasPaymentTimeConflict } from "@/lib/payments/availability";
import { requestPaytrToken } from "@/lib/payments/paytr/token";
import { logPaymentAudit } from "@/lib/payments/audit";

export const dynamic = "force-dynamic";

// PayTR'ın güncel zorunlu alan sınırlarıyla eşleştirilmiş - server-side zorunlu, frontend
// doğrulamasına güvenilmez. Sahte/varsayılan değer YOK: hepsi gerçek, kullanıcının kendi girdiği veri.
const schema = z.object({
  paymentId: z.string().min(1),
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(100),
  phone: z.string().trim().min(7).max(20),
  address: z.string().trim().min(5).max(400),
});

const ORIGIN = "https://safiradestan.com";

// Public - müşterinin kendi "Güvenli Ödemeye Geç" tıklamasıyla tetiklenir. Bu isteğin KENDİSİ
// müşterinin gerçek IP'sini taşır (PayTR'ın zorunlu user_ip alanı için doğru kaynak - admin'in
// "Ödeme Oluştur" anında değil).
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Lütfen tüm alanları eksiksiz doldurun." }, { status: 400 });
  }
  const { paymentId, name, email, phone, address } = parsed.data;

  let payment = await getPayment(paymentId);
  if (!payment) {
    return Response.json({ ok: false, error: "Ödeme bulunamadı." }, { status: 404 });
  }
  payment = await maybeExpirePayment(payment);

  if (payment.status !== "created") {
    const message = payment.status === "paid"
      ? "Bu ödeme zaten tamamlandı."
      : payment.status === "pending"
        ? "Bu ödeme için bir işlem zaten sürüyor. Sayfayı yenileyip tekrar deneyin."
        : "Bu ödeme denemesi artık geçerli değil. Yeni bir ödeme linki için bizimle iletişime geçin.";
    return Response.json({ ok: false, error: message }, { status: 409 });
  }

  const conflict = await hasPaymentTimeConflict(payment.villa, payment.checkIn, payment.checkOut, payment.reservationId);
  if (conflict) {
    await logPaymentAudit("PAYMENT_CONFLICT_BLOCKED", { paymentId, reservationId: payment.reservationId, villa: payment.villa });
    return Response.json({ ok: false, error: "Bu tarihler için müsaitlik durumu değişti. Lütfen bizimle iletişime geçin." }, { status: 409 });
  }

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
    userName: name,
    userAddress: address,
    userPhone: phone,
    okUrl: `${ORIGIN}/odeme/${paymentId}/basarili`,
    failUrl: `${ORIGIN}/odeme/${paymentId}/basarisiz`,
    testMode: payment.testMode,
  });

  if (!result.ok || !result.token || !result.iframeUrl || !result.expiresAt) {
    await markPaymentFailed(paymentId, result.error ?? "Token alınamadı.");
    await logPaymentAudit("PAYMENT_TOKEN_FAILED", { paymentId, reservationId: payment.reservationId, villa: payment.villa });
    return Response.json({ ok: false, error: result.error ?? "Ödeme oturumu başlatılamadı." }, { status: 502 });
  }

  await markPaymentPending(paymentId, result.expiresAt);
  await logPaymentAudit("PAYMENT_TOKEN_ISSUED", { paymentId, reservationId: payment.reservationId, villa: payment.villa, amountMinor: payment.requestedAmountMinor });

  return Response.json({ ok: true, iframeUrl: result.iframeUrl });
}
