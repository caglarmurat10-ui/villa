import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BookingInquiryConflictError,
  createBookingInquiry,
  normalizeBookingPhone,
} from "@/lib/booking-inquiries";
import { createPayment, getActivePaymentForReservation } from "@/lib/payments/db";
import { upsertBookingGuestDetails } from "@/lib/booking-guest-details";
import { isPaytrConfigured } from "@/lib/payments/paytr/config";
import { FULL_PAYMENT_MAX_INSTALLMENT, PAYTR_TEST_MODE } from "@/lib/payments/types";
import { clientIpFromHeaders, isRateLimited, recordRateLimitHit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT_SCOPE = "PUBLIC_BOOKING_INQUIRY";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 8;

const schema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  guestName: z.string().trim().min(2, "Ad soyad gerekli.").max(60),
  email: z.string().trim().email("Geçerli bir e-posta girin.").max(100)
    .refine((value) => /^[\x00-\x7F]+$/.test(value), "E-posta yalnız standart karakterler içermelidir."),
  phone: z.string().trim().min(7, "Telefon numarası gerekli.").max(30),
  address: z.string().trim().min(5, "Açık adres gerekli.").max(400),
  identityNo: z.string().trim().min(5, "T.C. Kimlik veya pasaport numarası gerekli.").max(32),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  guestCount: z.coerce.number().int().min(1).max(12),
  note: z.string().trim().max(500).default(""),
  website: z.string().max(0).optional().default(""),
  source: z.string().trim().max(40).optional().default("web"),
}).superRefine((value, context) => {
  if (value.checkOut <= value.checkIn) {
    context.addIssue({ code: "custom", path: ["checkOut"], message: "Çıkış tarihi girişten sonra olmalı." });
  }
  const phone = normalizeBookingPhone(value.phone);
  if (phone.length < 10 || phone.length > 15) {
    context.addIssue({ code: "custom", path: ["phone"], message: "Geçerli bir telefon numarası girin." });
  }
});

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek biçimi." }, { status: 415 });
  }

  const ip = clientIpFromHeaders(request.headers);
  if (await isRateLimited(ip, RATE_LIMIT_SCOPE, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX)) {
    return NextResponse.json({ error: "Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin." }, { status: 429 });
  }
  await recordRateLimitHit(ip, RATE_LIMIT_SCOPE);

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Bilgileri kontrol edin.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (parsed.data.website) {
    return NextResponse.json({ ok: true, message: "Talebiniz alındı." });
  }

  try {
    const result = await createBookingInquiry({
      villa: parsed.data.villa,
      guestName: parsed.data.guestName,
      phone: parsed.data.phone,
      checkIn: parsed.data.checkIn,
      checkOut: parsed.data.checkOut,
      guestCount: parsed.data.guestCount,
      note: parsed.data.note,
      source: parsed.data.source,
    });

    // Kimlik/adres/e-posta ödeme audit log'undan ve genel reservation note alanından ayrı tutulur.
    // Admin yalnız yetkili booking-inquiry detay endpoint'i üzerinden okur.
    await upsertBookingGuestDetails(result.inquiry.id, {
      email: parsed.data.email,
      address: parsed.data.address,
      identityNo: parsed.data.identityNo,
    });

    let paymentId: string | null = null;
    let paymentMessage = "";
    const paytrConfigured = await isPaytrConfigured();

    // Bu public self-service ödeme adımı bilinçli olarak yalnız TEST MODUNDA çalışır.
    // PAYTR_TEST_MODE=false olduğunda bu endpoint ödeme kaydı/iframe üretmez; gerçek canlı tahsilat
    // için ayrıca açık kullanıcı onayı + merchant doğrulaması + ayrı deploy gerekir.
    if (result.inquiry.quotedTotal !== null && paytrConfigured && PAYTR_TEST_MODE) {
      let payment = await getActivePaymentForReservation(result.inquiry.id);

      if (!payment) {
        const totalMinor = Math.round(result.inquiry.quotedTotal * 100);
        payment = await createPayment({
          reservationId: result.inquiry.id,
          paymentType: "full_payment",
          reservationTotalMinor: totalMinor,
          requestedAmountMinor: totalMinor,
          noInstallment: false,
          maxInstallment: FULL_PAYMENT_MAX_INSTALLMENT,
          testMode: true,
        });
      }

      // Pending ödeme zaten PayTR'da sürüyor; aynı payment için ikinci iframe başlatmayız.
      paymentId = payment?.status === "created" ? payment.id : null;
      if (payment?.status === "pending") paymentMessage = "Bu rezervasyon için test kart ödeme işlemi zaten sürüyor.";
    } else if (!PAYTR_TEST_MODE) {
      paymentMessage = "Rezervasyon bilgileriniz alındı. Canlı kart ödeme adımı henüz etkinleştirilmedi.";
    }

    const defaultMessage = result.duplicate
      ? "Bu tarihler için bilgileriniz zaten alınmış."
      : "Rezervasyon bilgileriniz kaydedildi.";

    const message = paymentId
      ? `${defaultMessage} Güvenli kart ödeme ekranı hazırlanıyor.`
      : paymentMessage || (paytrConfigured
          ? `${defaultMessage} Kart ödeme ekranı şu anda başlatılamadı; ekibimiz sizinle iletişime geçecek.`
          : `${defaultMessage} Kart ödeme altyapısı henüz aktif olmadığı için ödeme alınmadı.`);

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      inquiryId: result.inquiry.id,
      paymentId,
      testMode: PAYTR_TEST_MODE,
      message,
    }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof BookingInquiryConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[Public booking inquiry]", error instanceof Error ? error.message : "Bilinmeyen hata");
    return NextResponse.json({ error: "Bilgileriniz şu anda kaydedilemedi. Lütfen daha sonra tekrar deneyin." }, { status: 500 });
  }
}
