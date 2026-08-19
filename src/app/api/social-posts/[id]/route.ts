import { deleteSocialPost, updateSocialPostStatus } from "@/lib/social-db";
import { socialPostStatusSchema } from "@/lib/schema";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const parsed = socialPostStatusSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Geçerli paylaşım durumu seçin." }, { status: 400 });
  const post = await updateSocialPostStatus(id, parsed.data.status);
  return post ? Response.json({ post }) : Response.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return await deleteSocialPost(id) ? Response.json({ success: true }) : Response.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
}
