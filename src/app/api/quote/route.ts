import { calculateReservationQuote } from "@/lib/db";
import { z } from "zod";

export async function POST(request: Request) {
  const parsed = z.object({ villa: z.enum(["Safira","Destan"]), checkIn: z.iso.date(), checkOut: z.iso.date() }).safeParse(await request.json());
  if (!parsed.success || parsed.data.checkOut <= parsed.data.checkIn) return Response.json({ error: "Geçerli tarih aralığı seçin." }, { status: 400 });
  try { return Response.json(await calculateReservationQuote(parsed.data.villa, parsed.data.checkIn, parsed.data.checkOut)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Fiyat hesaplanamadı" }, { status: 404 }); }
}
