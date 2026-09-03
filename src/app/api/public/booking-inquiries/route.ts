import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BookingInquiryConflictError,
  createBookingInquiry,
  normalizeBookingPhone,
} from "@/lib/booking-inquiries";
import { clientIpFromHeaders, isRateLimited, recordRateLimitHit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT_SCOPE = "PUBLIC_BOOKING_INQUIRY";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 8; // 15 dakikada IP başına 8 deneme - gerçek bir aile birkaç kez dener, spam flood bunu hızla aşar

const schema = z.object({
  villa: z.enum(["Safira", "Destan"]),
  guestName: z.string().trim().min(2, "Ad soyad gerekli.").max(100),
  phone: z.string().trim().min(7, "Telefon numarası gerekli.").max(30),
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
    const { website: _website, ...input } = parsed.data;
    const result = await createBookingInquiry(input);
    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      inquiryId: result.inquiry.id,
      message: result.duplicate
        ? "Bu tarihler için talebiniz zaten alınmış. En kısa sürede sizinle iletişime geçeceğiz."
        : "Rezervasyon talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz.",
    }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof BookingInquiryConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[Public booking inquiry]", error instanceof Error ? error.message : "Bilinmeyen hata");
    return NextResponse.json({ error: "Talebiniz şu anda kaydedilemedi. Lütfen daha sonra tekrar deneyin." }, { status: 500 });
  }
}
