import { addPriceRange, listPriceRanges } from "@/lib/db";
import { priceRangeSchema } from "@/lib/schema";

export async function GET() { return Response.json({ prices: await listPriceRanges() }); }
export async function POST(request: Request) {
  const parsed = priceRangeSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz fiyat dönemi" }, { status: 400 });
  try { return Response.json({ price: await addPriceRange(parsed.data) }, { status: 201 }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Fiyat eklenemedi" }, { status: 409 }); }
}
