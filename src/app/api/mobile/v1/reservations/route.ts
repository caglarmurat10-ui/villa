import { createReservation, listReservations } from "@/lib/db";
import { reservationSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

// Aynı doğrulama/oluşturma mantığı web admin'in /api/reservations'ı ile birebir - iş mantığı
// duplike edilmiyor, yalnız mobil için filtreleme parametreleri (villa/arama/tarih) eklendi.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const villa = url.searchParams.get("villa");
  const search = url.searchParams.get("search")?.trim().toLowerCase();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let reservations = await listReservations();
  if (villa === "Safira" || villa === "Destan") {
    reservations = reservations.filter((r) => r.villa === villa);
  }
  if (search) {
    reservations = reservations.filter((r) =>
      r.guestName.toLowerCase().includes(search) || r.phone.toLowerCase().includes(search),
    );
  }
  if (from) reservations = reservations.filter((r) => r.checkOut >= from);
  if (to) reservations = reservations.filter((r) => r.checkIn <= to);

  reservations.sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  return Response.json({ reservations });
}

export async function POST(request: Request) {
  const parsed = reservationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi" }, { status: 400 });
  }
  try {
    return Response.json({ reservation: await createReservation(parsed.data) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Kayıt oluşturulamadı" }, { status: 409 });
  }
}
