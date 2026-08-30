import { createSocialPost, listSocialPosts } from "@/lib/social-db";
import { socialPostSchema } from "@/lib/schema";
import { approvedProxyMediaAsset } from "@/lib/social-drive-media";
import { replaceSocialPostMedia } from "@/lib/social-media-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ posts: await listSocialPosts() });
}

export async function POST(request: Request) {
  const parsed = socialPostSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz paylaşım bilgisi" }, { status: 400 });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  if (parsed.data.scheduledDate < today) return Response.json({ error: "Geçmiş bir tarihe paylaşım planlanamaz." }, { status: 400 });

  const mediaUrls = [...new Set([...(parsed.data.mediaUrls ?? []), ...(parsed.data.mediaUrl ? [parsed.data.mediaUrl] : [])])].slice(0, 10);
  const mediaItems: Array<{ mediaUrl: string; kind: "image" | "video" }> = [];

  if (parsed.data.platform === "Instagram" || parsed.data.platform === "Facebook") {
    const requestOrigin = new URL(request.url).origin;
    const allowedOrigins = [requestOrigin, "https://villa-yonetim.caglarmurat10.workers.dev"];
    for (const url of mediaUrls) {
      const asset = approvedProxyMediaAsset(parsed.data.villa, url, allowedOrigins);
      if (!asset) {
        return Response.json({ error: `Instagram/Facebook için yalnız Villa ${parsed.data.villa} doğrulanmış Drive medyası kullanılabilir.` }, { status: 400 });
      }
      mediaItems.push({ mediaUrl: url, kind: asset.mediaKind });
    }

    if (parsed.data.platform === "Instagram" && mediaItems.length === 0) {
      return Response.json({ error: "Instagram için doğrulanmış medya seçilmelidir." }, { status: 400 });
    }
    if (parsed.data.contentType === "Reels") {
      if (mediaItems.length !== 1 || mediaItems[0]?.kind !== "video") {
        return Response.json({ error: "Reels için Villa'ya ait tek bir doğrulanmış video seçilmelidir." }, { status: 400 });
      }
    }
    if (parsed.data.contentType === "Hikâye" && mediaItems.length !== 1) {
      return Response.json({ error: "Hikâye için tek bir doğrulanmış görsel veya video seçilmelidir." }, { status: 400 });
    }
    if (parsed.data.contentType === "Gönderi" && mediaItems.length > 1 && mediaItems.length < 2) {
      return Response.json({ error: "Carousel için en az iki medya seçilmelidir." }, { status: 400 });
    }
    if (parsed.data.contentType === "Gönderi" && mediaItems.length === 1 && mediaItems[0]?.kind === "video") {
      return Response.json({ error: "Tek video Gönderi yerine Reels olarak planlanmalıdır." }, { status: 400 });
    }
  }

  const post = await createSocialPost({
    ...parsed.data,
    mediaUrl: mediaUrls[0] ?? "",
    mediaUrls,
  });
  if (mediaItems.length > 0) await replaceSocialPostMedia(post.id, mediaItems);

  return Response.json({
    post: {
      ...post,
      mediaUrl: mediaUrls[0] ?? "",
      mediaUrls,
      approvalStatus: "İnsan onayı",
      approvedAt: null,
    },
  }, { status: 201 });
}
