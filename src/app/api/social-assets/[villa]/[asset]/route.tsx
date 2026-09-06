import { getBrandImageBytes, isVilla } from "@/lib/social-brand-images";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ villa: string; asset: string }> }) {
  const { villa, asset } = await context.params;
  if (!isVilla(villa)) return new Response("Villa bulunamadı.", { status: 404 });
  if (asset !== "profile" && asset !== "cover") return new Response("Sosyal medya varlığı bulunamadı.", { status: 404 });

  const bytes = await getBrandImageBytes(villa, asset);
  return new Response(bytes, { headers: { "Content-Type": "image/png" } });
}
