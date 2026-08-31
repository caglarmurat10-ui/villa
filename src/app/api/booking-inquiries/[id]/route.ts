import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BookingInquiryConversionError,
  updateBookingInquiryStatus,
} from "@/lib/booking-inquiries";

const schema = z.object({
  status: z.enum(["Yeni", "İletişime geçildi", "Kapatıldı"]),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz talep durumu." }, { status: 400 });
  }

  try {
    const inquiry = await updateBookingInquiryStatus(id, parsed.data.status);
    if (!inquiry) return NextResponse.json({ error: "Rezervasyon talebi bulunamadı." }, { status: 404 });
    return NextResponse.json({ inquiry });
  } catch (error) {
    if (error instanceof BookingInquiryConversionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Booking inquiry update]", error instanceof Error ? error.message : "Bilinmeyen hata");
    return NextResponse.json({ error: "Rezervasyon talebi güncellenemedi." }, { status: 500 });
  }
}
