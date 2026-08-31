import { NextResponse } from "next/server";
import {
  BookingInquiryConversionError,
  convertBookingInquiryToReservation,
} from "@/lib/booking-inquiries";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await convertBookingInquiryToReservation(id);
    if (!result) return NextResponse.json({ error: "Rezervasyon talebi bulunamadı." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BookingInquiryConversionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Booking inquiry convert]", error instanceof Error ? error.message : "Bilinmeyen hata");
    return NextResponse.json({ error: "Talep rezervasyona dönüştürülemedi." }, { status: 500 });
  }
}
