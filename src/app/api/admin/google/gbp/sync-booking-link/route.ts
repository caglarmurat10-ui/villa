import { z } from "zod";
import { getAllGbpLocationMappings } from "@/lib/gbp/mapping";
import { ensureGbpBookingLink } from "@/lib/gbp/profile";

export const dynamic = "force-dynamic";

const schema = z.object({ villa: z.enum(["Safira", "Destan"]) });

// Faz 6.1 bölüm 5 - "İki mapping persist edilmeden mutation YOK": Safira VE Destan'ın ikisi de
// gerçek, doğrulanmış bir GBP location'a eşlenmiş olmadan bu rota HİÇBİR yazma denemesi yapmaz -
// tek villa eşliyse bile diğer villa boşken engellenir (kasıtlı olarak katı yorum).
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Geçersiz istek." }, { status: 400 });

  const mappings = await getAllGbpLocationMappings();
  if (!mappings.Safira || !mappings.Destan) {
    return Response.json({ error: "Her iki villa için de GBP location eşlemesi tamamlanmadan booking link güncellemesi yapılmaz. Önce /entegrasyonlar üzerinden ikisini de seçin." }, { status: 409 });
  }

  const mapping = mappings[parsed.data.villa]!;
  const result = await ensureGbpBookingLink(parsed.data.villa, mapping.locationName);
  if (result.action === "blocked") {
    return Response.json({ error: result.error ?? "Booking link güncellenemedi.", result }, { status: 502 });
  }
  return Response.json({ ok: true, result });
}
