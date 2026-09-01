import { z } from "zod";
import { getPayment, claimPaymentForCheckout, markPaymentFailedIfPending, maybeExpirePayment } from "@/lib/payments/db";
import { hasPaymentTimeConflict } from "@/lib/payments/availability";
import { requestPaytrToken } from "@/lib/payments/paytr/token";
import { logPaymentAudit } from "@/lib/payments/audit";

export const dynamic = "force-dynamic";

// PayTR'ın güncel zorunlu alan sınırlarıyla eşleştirilmiş - server-side zorunlu, frontend
// doğrulamasına güvenilmez. Sahte/varsayılan değer YOK: hepsi gerçek, kullanıcının kendi girdiği veri.
// PayTR resmi dokümanı email alanında Türkçe/ASCII-dışı karakter kabul etmiyor - ayrı bir ASCII guard.
const schema = z.object({
  paymentId: z.string().min(1),
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(100).refine((value) => /^[\x00-\x7F]+$/.test(value), "E-posta yalnız ASCII karakter içermelidir."),
  phone: z.string().trim().min(7).max(20),
  address: z.string().trim().min(5).max(400),
});

const ORIGIN = "https://safiradestan.com";
const TIMEOUT_LIMIT_MINUTES = 30; // token.ts'teki ile aynı - claim'in provisional expiry'si bununla hesaplanır.
const MAX_USER_IP_LENGTH = 39; // PayTR'ın dokümante ettiği user_ip üst sınırı (IPv6'yı kapsar).

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

  // Kaynak-doğruluk YALNIZ D1'deki payments.test_mode - istemciden gelen hiçbir alan (query/body)
  // bu kontrolü etkilemez. PAYTR_TEST_MODE=false olduğunda GERÇEK ödemeler için bu guard'ın hiçbir
  // dalı atlanmaz - bypass yalnız test_mode=1 kaydına bağlıdır, global bir env/flag değil.
  const conflict = await hasPaymentTimeConflict(payment.villa, payment.checkIn, payment.checkOut, payment.reservationId);
  if (conflict) {
    if (!payment.testMode) {
      await logPaymentAudit("PAYMENT_CONFLICT_BLOCKED", { paymentId, reservationId: payment.reservationId, villa: payment.villa });
      return Response.json({ ok: false, error: "Bu tarihler için müsaitlik durumu değişti. Lütfen bizimle iletişime geçin." }, { status: 409 });
    }
    // Yalnız test payment - PayTR sağlayıcı bağlantısını uçtan uca test edebilmek için müsaitlik
    // çakışması testi engellemez. Gerçek finansı hiçbir zaman etkilemez (testMode=true zaten
    // markPaymentPaidIfPending'de reservations.paid_amount güncellemesini atlıyor).
    await logPaymentAudit("PAYMENT_TEST_CONFLICT_BYPASSED", { paymentId, reservationId: payment.reservationId, villa: payment.villa });
  }

  // Cloudflare Worker arkasında gerçek public trafik her zaman bu header'ı taşır - müşterinin
  // kendisinin belirleyebileceği bir query/body alanı DEĞİL. Yoksa/anormal uzunluktaysa PayTR'a hiç
  // istek atılmaz (sahte/varsayılan IP ile devam edilmez), ham IP hiçbir yere loglanmaz.
  const userIp = request.headers.get("cf-connecting-ip");
  if (!userIp || userIp.length > MAX_USER_IP_LENGTH) {
    return Response.json({ ok: false, error: "Ödeme oturumu başlatılamadı." }, { status: 400 });
  }

  // ATOMİK CLAIM: PayTR'a dış istek yapmadan ÖNCE tek bir koşullu UPDATE ile "created" durumunu bu
  // isteğe kilitler. İki eşzamanlı istek aynı payment'a claim denerse yalnız biri true görür - kaybeden
  // PayTR'a hiç istek atmaz.
  const provisionalExpiresAt = new Date(Date.now() + TIMEOUT_LIMIT_MINUTES * 60 * 1000).toISOString();
  const claimed = await claimPaymentForCheckout(paymentId, provisionalExpiresAt);
  if (!claimed) {
    return Response.json({ ok: false, error: "Bu ödeme için bir işlem zaten sürüyor. Sayfayı yenileyip tekrar deneyin." }, { status: 409 });
  }

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

  if (!result.ok || !result.iframeUrl) {
    // Claim'i geri al - CAS (yalnız hâlâ pending ise), çünkü bu sırada bir callback aynı payment'ı
    // paid/failed yapmış olabilir (mümkün değil normalde, token hiç üretilmediği için, ama savunma).
    await markPaymentFailedIfPending(paymentId, result.error ?? "Token alınamadı.");
    await logPaymentAudit("PAYMENT_TOKEN_FAILED", { paymentId, reservationId: payment.reservationId, villa: payment.villa });
    return Response.json({ ok: false, error: result.error ?? "Ödeme oturumu başlatılamadı." }, { status: 502 });
  }

  await logPaymentAudit("PAYMENT_TOKEN_ISSUED", { paymentId, reservationId: payment.reservationId, villa: payment.villa, amountMinor: payment.requestedAmountMinor });

  return Response.json({ ok: true, iframeUrl: result.iframeUrl });
}
