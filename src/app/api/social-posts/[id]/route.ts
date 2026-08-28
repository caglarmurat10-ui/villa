import {
  deleteSocialPost,
  getSocialPost,
  updateSocialPostApproval,
  updateSocialPostStatus,
} from "@/lib/social-db";
import { socialPostApprovalSchema, socialPostStatusSchema } from "@/lib/schema";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();

  const approval = socialPostApprovalSchema.safeParse(body);
  if (approval.success) {
    const current = await getSocialPost(id);
    if (!current) return Response.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
    if (current.status === "Yayınlandı") {
      return Response.json({ error: "Yayınlanmış paylaşımın onay durumu değiştirilemez." }, { status: 409 });
    }
    const post = await updateSocialPostApproval(id, approval.data.approvalStatus);
    return Response.json({ post });
  }

  const status = socialPostStatusSchema.safeParse(body);
  if (!status.success) {
    return Response.json({ error: "Geçerli paylaşım veya onay durumu seçin." }, { status: 400 });
  }

  if (status.data.status === "Yayınlandı") {
    const current = await getSocialPost(id);
    if (!current) return Response.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
    if (current.approvalStatus !== "Onaylandı") {
      return Response.json({ error: "Paylaşım yayınlanmadan önce insan onayı verilmelidir." }, { status: 409 });
    }
  }

  const post = await updateSocialPostStatus(id, status.data.status);
  return post ? Response.json({ post }) : Response.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return await deleteSocialPost(id) ? Response.json({ success: true }) : Response.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
}
