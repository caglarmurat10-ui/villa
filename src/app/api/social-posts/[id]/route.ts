import {
  deleteSocialPost,
  getSocialPost,
  updateSocialPostApproval,
  updateSocialPostStatus,
} from "@/lib/social-db";
import { socialPostApprovalSchema, socialPostMediaSchema, socialPostStatusSchema } from "@/lib/schema";
import { approvedProxyMediaAsset } from "@/lib/social-drive-media";
import { deleteSocialPostMedia, replaceSocialPostMedia } from "@/lib/social-media-store";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();

  const media = socialPostMediaSchema.safeParse(body);
  if (media.success) {
    const current = await getSocialPost(id);
    if (!current) return Response.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
    if (current.status === "Yayınlandı") return Response.json({ error: "Yayınlanmış paylaşımın medyası değiştirilemez." }, { status: 409 });
    if (current.platform !== "Instagram" && current.platform !== "Facebook") {
      return Response.json({ error: "Çoklu doğrulanmış medya yalnız Instagram/Facebook için kullanılabilir." }, { status: 409 });
    }

    const allowedOrigins = [new URL(request.url).origin, "https://villa-yonetim.caglarmurat10.workers.dev"];
    const items: Array<{ mediaUrl: string; kind: "image" | "video" }> = [];
    for (const url of [...new Set(media.data.mediaUrls)]) {
      const asset = approvedProxyMediaAsset(current.villa, url, allowedOrigins);
      if (!asset) return Response.json({ error: `Villa ${current.villa} için doğrulanmamış medya kullanılamaz.` }, { status: 400 });
      items.push({ mediaUrl: url, kind: asset.mediaKind });
    }

    if (current.contentType === "Reels" && (items.length !== 1 || items[0]?.kind !== "video")) {
      return Response.json({ error: "Reels için tek bir doğrulanmış video seçin." }, { status: 400 });
    }
    if (current.contentType === "Hikâye" && items.length !== 1) {
      return Response.json({ error: "Hikâye için tek bir medya seçin." }, { status: 400 });
    }
    if (current.contentType === "Gönderi" && items.length === 1 && items[0]?.kind === "video") {
      return Response.json({ error: "Tek video Reels olarak planlanmalıdır." }, { status: 400 });
    }

    const saved = await replaceSocialPostMedia(id, items);
    const updated = await getSocialPost(id);
    return Response.json({ post: updated ? { ...updated, mediaUrls: saved.map((item) => item.mediaUrl) } : null });
  }

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
    return Response.json({ error: "Geçerli paylaşım, medya veya onay durumu seçin." }, { status: 400 });
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
  const deleted = await deleteSocialPost(id);
  if (!deleted) return Response.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
  try { await deleteSocialPostMedia(id); } catch {}
  return Response.json({ success: true });
}
