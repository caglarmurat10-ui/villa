import { parseNotificationForm, verifyNotificationHash } from "@/lib/payments/paytr/callback";
import { getPaymentByMerchantOid, markPaymentFailedIfPending, markPaymentPaidIfPending, flagPaymentAmountMismatch } from "@/lib/payments/db";
import {
  extendLivePaymentHold,
  finalizeLiveBookingPayment,
  releaseLivePaymentHold,
} from "@/lib/payments/live-booking";
import { logPaymentAudit } from "@/lib/payments/audit";

export const dynamic = "force-dynamic";

function okResponse() {
  return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}

// Public - PayTR'ın server-to-server Bildirim URL hedefi. Admin auth YOK (provider callback'i).
// Hash doğrulanmadan HİÇBİR D1 state değişikliği yapılmaz. Ham form body/hash/secret asla loglanmaz -
// yalnız audit.ts'in izin verdiği güvenli alanlar.
//
// "İlk notification kazanır" kuralı burada D1 SEVİYESİNDE garanti edilir. Test/admin payment'larda
// markPaymentPaidIfPending/markPaymentFailedIfPending koşullu UPDATE'leri kullanılır. Public CANLI
// payment'ta başarılı callback, live-booking.ts içinde payment + inquiry + tarih hold + reservation'ı
// aynı D1 batch/transaction içinde sonuçlandırır.
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

  if (notification.status === "success") {
    // total_amount, taksit/vade farkıyla requested_amount'tan YÜKSEK olabilir (normal, PayTR'ın
    // kendi dokümante ettiği davranış) - bu yüzden eşitlik değil, alt sınır kontrolü yapılır.
    // payment_amount ise (varsa) bizim orijinal isteğimizin birebir yankısı olmalı - markup'a tabi
    // değil, bu yüzden tam eşleşmesi beklenir.
    const totalOk = notification.totalAmountMinor >= payment.requestedAmountMinor;
    const paymentAmountOk = notification.paymentAmountMinor === undefined || notification.paymentAmountMinor === payment.requestedAmountMinor;
    const currencyOk = !notification.currency || notification.currency === "TL" || notification.currency === "TRY";

    if (!totalOk || !paymentAmountOk || !currencyOk) {
      await flagPaymentAmountMismatch(
        payment.id,
        `Tutar uyuşmazlığı - inceleme gerekiyor (bildirilen: ${notification.totalAmountMinor}, beklenen: ${payment.requestedAmountMinor}).`,
      );
      if (!payment.testMode) {
        // Gerçek para bildirimi geldi ama tutar doğrulanamadıysa tarihleri hemen yeniden satışa
        // açmayız; manuel inceleme için 24 saat daha kilitli tutarız.
        await extendLivePaymentHold(payment.id, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      }
      await logPaymentAudit("PAYMENT_CALLBACK_AMOUNT_MISMATCH", {
        paymentId: payment.id,
        reservationId: payment.reservationId,
        villa: payment.villa,
        amountMinor: notification.totalAmountMinor,
      });
      // State değiştirilmez (paid yapılmaz) - ama hash zaten geçerli olduğu için sonsuz retry'ı
      // durdurmak amacıyla OK dönülür, last_error admin panelinde açıkça görünür.
      return okResponse();
    }

    if (!payment.testMode) {
      if (payment.status !== "pending") {
        await logPaymentAudit("PAYMENT_CALLBACK_TERMINAL_IGNORED", {
          paymentId: payment.id,
          reservationId: payment.reservationId,
          villa: payment.villa,
          status: payment.status,
        });
        return okResponse();
      }

      // Başarılı gerçek tahsilat artık geri döndürülemez bir olaydır. Callback retry/DB hatası
      // sırasında tarihlerin serbest kalmaması için hold'u önce 24 saat uzat; finalizer başarıyla
      // biterse aynı transaction içinde status='paid' yapar ve kilit aktif olmaktan çıkar.
      await extendLivePaymentHold(payment.id, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

      try {
        const finalized = await finalizeLiveBookingPayment(payment, notification.totalAmountMinor);
        if (finalized.alreadyFinalized) {
          await logPaymentAudit("PAYMENT_CALLBACK_TERMINAL_IGNORED", {
            paymentId: payment.id,
            reservationId: finalized.reservationId,
            villa: payment.villa,
            status: "paid",
          });
          return okResponse();
        }

        await logPaymentAudit("PAYMENT_PAID", {
          paymentId: payment.id,
          reservationId: finalized.reservationId,
          villa: payment.villa,
          paymentType: payment.paymentType,
          amountMinor: notification.totalAmountMinor,
        });
      } catch (error) {
        // PayTR yalnız düz "OK" görünce retry'ı bırakır. Gerçek tahsilat geldiği halde rezervasyon
        // transaction'ı tamamlanamadıysa 500 dönerek provider'ın bildirimi tekrar göndermesini isteriz.
        // Secret/hash/form body loglanmaz; yalnız güvenli payment id + hata mesajı.
        console.error(`[PayTR callback] live finalize failed for ${payment.id}: ${error instanceof Error ? error.message : "unknown error"}`);
        return new Response("Retry", { status: 500, headers: { "Content-Type": "text/plain" } });
      }
    } else {
      const won = await markPaymentPaidIfPending(payment, notification.totalAmountMinor);
      if (!won) {
        // Bu callback "ilk kazanan" değildi - payment zaten terminal bir duruma ulaşmıştı.
        await logPaymentAudit("PAYMENT_CALLBACK_TERMINAL_IGNORED", { paymentId: payment.id, reservationId: payment.reservationId, villa: payment.villa, status: payment.status });
        return okResponse();
      }

      await logPaymentAudit("PAYMENT_PAID", {
        paymentId: payment.id,
        reservationId: payment.reservationId,
        villa: payment.villa,
        paymentType: payment.paymentType,
        amountMinor: notification.totalAmountMinor,
      });
    }
  } else {
    const safeReason = notification.failedReasonMsg ? notification.failedReasonMsg.slice(0, 200) : "Ödeme başarısız.";
    const won = await markPaymentFailedIfPending(payment.id, safeReason);
    if (!won) {
      await logPaymentAudit("PAYMENT_CALLBACK_TERMINAL_IGNORED", { paymentId: payment.id, reservationId: payment.reservationId, villa: payment.villa, status: payment.status });
      return okResponse();
    }
    if (!payment.testMode) await releaseLivePaymentHold(payment.id);
    await logPaymentAudit("PAYMENT_FAILED", { paymentId: payment.id, reservationId: payment.reservationId, villa: payment.villa, paymentType: payment.paymentType });
  }

  return okResponse();
}
