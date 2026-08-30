import { NextResponse } from "next/server";
import { listBookingInquiries } from "@/lib/booking-inquiries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const inquiries = await listBookingInquiries();
    return NextResponse.json({ inquiries });
  } catch (error) {
    console.error("[Booking inquiries list]", error instanceof Error ? error.message : "Bilinmeyen hata");
    return NextResponse.json({ error: "Rezervasyon talepleri yüklenemedi." }, { status: 500 });
  }
}
