import { isVilla, renderCoverImage, renderProfileImage } from "@/lib/social-brand-images";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ villa: string; asset: string }> }) {
  const { villa, asset } = await context.params;
  if (!isVilla(villa)) return new Response("Villa bulunamadı.", { status: 404 });
  if (asset === "profile") return renderProfileImage(villa);
  if (asset === "cover") return renderCoverImage(villa);
  return new Response("Sosyal medya varlığı bulunamadı.", { status: 404 });
}
