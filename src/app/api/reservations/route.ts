import { createReservation, listReservations } from "@/lib/db";
import { reservationSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ reservations: await listReservations() });
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
