import { NextResponse } from "next/server";
import { getBookingGuestDetails } from "@/lib/booking-guest-details";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const details = await getBookingGuestDetails(id);
  if (!details) return NextResponse.json({ error: "Misafir bilgileri bulunamadı." }, { status: 404 });
  return NextResponse.json({ details });
}
