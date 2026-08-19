import { softDeleteReservation, updatePayment, updateReservation } from "@/lib/db";
import { reservationSchema } from "@/lib/schema";
import { z } from "zod";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = reservationSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz bilgi" }, { status: 400 });
  try { return Response.json({ reservation: await updateReservation(id, parsed.data) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Güncellenemedi" }, { status: 409 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = z.object({ paidAmount: z.coerce.number().nonnegative() }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Geçerli ödeme tutarı girin." }, { status: 400 });
  try { return Response.json({ reservation: await updatePayment(id, parsed.data.paidAmount) }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Ödeme güncellenemedi" }, { status: 400 }); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!await softDeleteReservation(id)) return Response.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  return Response.json({ success: true });
}
