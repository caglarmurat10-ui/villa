import { listReservations, softDeleteReservation, updatePayment, updateReservation, updateReservationPhone } from "@/lib/db";
import { reservationSchema } from "@/lib/schema";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const reservation = (await listReservations()).find((r) => r.id === id);
  if (!reservation) return Response.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  return Response.json({ reservation });
}

// Aynı reservationSchema/updateReservation - web admin'in PUT /api/reservations/[id] ile aynı mantık.
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = reservationSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi" }, { status: 400 });
  try { return Response.json({ reservation: await updateReservation(id, parsed.data) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Güncellenemedi" }, { status: 409 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const parsed = z.union([
    z.object({ paidAmount: z.coerce.number().nonnegative() }),
    z.object({ phone: z.string().trim().min(5, "Geçerli WhatsApp numarası girin.").max(30) }),
  ]).safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Geçerli bilgi girin." }, { status: 400 });
  try {
    const reservation = "phone" in parsed.data
      ? await updateReservationPhone(id, parsed.data.phone)
      : await updatePayment(id, parsed.data.paidAmount);
    return Response.json({ reservation });
  }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Güncellenemedi" }, { status: 400 }); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!await softDeleteReservation(id)) return Response.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  return Response.json({ success: true });
}
