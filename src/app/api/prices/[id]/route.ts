import { deletePriceRange } from "@/lib/db";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return await deletePriceRange(id) ? Response.json({ success: true }) : Response.json({ error: "Fiyat dönemi bulunamadı" }, { status: 404 });
}
