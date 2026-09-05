import { z } from "zod";
import { getInstagramPublishingLimit } from "@/lib/meta";
import {
  publishInstagramCarousel,
  publishInstagramReel,
  publishInstagramSingleImage,
  publishInstagramStory,
} from "@/lib/instagram-publish";
import { getInstagramCredentials } from "@/lib/meta-store";
import {
  claimSocialPublishAttempt,
  getSocialPost,
  markSocialPublishFailure,
  markSocialPublishSuccess,
} from "@/lib/social-db";
import { approvedProxyMediaAsset } from "@/lib/social-drive-media";
import { listSocialPostMedia, type SocialPostMediaItem } from "@/lib/social-media-store";

const schema = z.object({
  postId: z.string().trim().min(1, "Paylaşım kimliği gerekli."),
});

function safePublicError(error: unknown) {
  const message = error instanceof Error && error.message
    ? error.message
    : "Instagram yayını başarısız.";
  return message
    .replace(
      /(access_token|client_secret|authorization_code|short_lived_token|long_lived_token|code)=([^&\s]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
    .slice(0, 360);
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz paylaşım." }, { status: 400 });

  const post = await getSocialPost(parsed.data.postId);
  if (!post) return Response.json({ error: "Paylaşım bulunamadı." }, { status: 404 });
  if (post.platform !== "Instagram") return Response.json({ error: "Bu endpoint yalnızca Instagram paylaşımları içindir." }, { status: 400 });
  if (post.status !== "Planlandı") return Response.json({ error: "Bu paylaşım daha önce yayınlanmış." }, { status: 409 });
  if (post.approvalStatus !== "Onaylandı") return Response.json({ error: "Instagram yayını için önce insan onayı verilmelidir." }, { status: 409 });
  // HARD GATE: Destan Instagram'ın Business Portfolio ownership sorunu çözülmedi - hem otomatik
  // cron hem manuel "Şimdi yayınla" için, Graph API'ye hiçbir istek gitmeden burada durur. Cron
  // tarafı aynı gate'i custom-worker.mjs'in duePosts() sorgusunda ayrıca uyguluyor (bu satırın cron
  // tarafından hiç seçilmemesi için); bu ikinci katman, endpoint'in doğrudan çağrılmasına karşı.
  if (post.villa === "Destan" && post.scheduledDate <= "2026-09-05") {
    return Response.json({ error: "Villa Destan Instagram eski bekleyen içerikleri güvenlik nedeniyle yeniden yayınlanmaz. 6 Eylül 2026 ve sonrası planlar aktiftir." }, { status: 409 });
  }

  const allowedOrigins = [new URL(request.url).origin, "https://villa-yonetim.caglarmurat10.workers.dev"];
  let media: SocialPostMediaItem[] = await listSocialPostMedia(post.id);
  if (media.length === 0 && post.mediaUrl) {
    const asset = approvedProxyMediaAsset(post.villa, post.mediaUrl, allowedOrigins);
    if (asset) media = [{ position: 0, mediaUrl: post.mediaUrl, kind: asset.mediaKind }];
  }

  if (media.length === 0) return Response.json({ error: "Instagram yayını için doğrulanmış medya gerekli." }, { status: 409 });
  for (const item of media) {
    const asset = approvedProxyMediaAsset(post.villa, item.mediaUrl, allowedOrigins);
    if (!asset || asset.mediaKind !== item.kind) {
      return Response.json({ error: `Villa ${post.villa} için doğrulanmamış veya medya türü değişmiş dosya Instagram'a gönderilemez.` }, { status: 409 });
    }
  }

  if (post.contentType === "Gönderi" && media.length === 1 && media[0]?.kind !== "image") {
    return Response.json({ error: "Tek video Instagram Gönderi yerine Reels olarak yayınlanmalıdır." }, { status: 409 });
  }
  if (post.contentType === "Gönderi" && media.length > 10) {
    return Response.json({ error: "Instagram Carousel en fazla 10 medya içerebilir." }, { status: 409 });
  }
  if (post.contentType === "Reels" && (media.length !== 1 || media[0]?.kind !== "video")) {
    return Response.json({ error: "Instagram Reels için tek bir doğrulanmış video gerekli." }, { status: 409 });
  }
  if (post.contentType === "Hikâye" && media.length !== 1) {
    return Response.json({ error: "Instagram Hikâye için tek bir doğrulanmış görsel veya video gerekli." }, { status: 409 });
  }

  const account = await getInstagramCredentials(post.villa).catch((error) => {
    console.error(`[Instagram Credentials] ${safePublicError(error)}`);
    return null;
  });
  if (!account) return Response.json({ error: `Villa ${post.villa} Instagram hesabı bağlı değil veya bağlantısı yenilenmeli.` }, { status: 409 });

  const claim = await claimSocialPublishAttempt(post.id);
  if (!claim) {
    return Response.json({ error: "Bu paylaşım başka bir yayın işlemi tarafından işleniyor veya artık yayına uygun değil." }, { status: 409 });
  }

  const { lockToken } = claim;
  try {
    const limit = await getInstagramPublishingLimit(account.accountId, account.accessToken);
    if (limit.remaining <= 0) {
      const message = `Instagram API yayın kotası dolu (${limit.quotaUsage}/${limit.quotaTotal}). Kota yenilenene kadar yayın gönderilmedi.`;
      await markSocialPublishFailure(post.id, lockToken, message);
      return Response.json({ error: message, quota: limit }, { status: 429 });
    }

    let mediaId: string;
    if (post.contentType === "Reels") {
      mediaId = await publishInstagramReel(account.accountId, account.accessToken, media[0].mediaUrl, post.caption);
    } else if (post.contentType === "Hikâye") {
      mediaId = await publishInstagramStory(account.accountId, account.accessToken, media[0]);
    } else if (media.length > 1) {
      mediaId = await publishInstagramCarousel(account.accountId, account.accessToken, media, post.caption);
    } else {
      mediaId = await publishInstagramSingleImage(
        account.accountId,
        account.accessToken,
        media[0].mediaUrl,
        post.caption,
        `Villa ${post.villa}, Patara / Kaş özel havuzlu villa`,
      );
    }

    const publishedPost = await markSocialPublishSuccess(post.id, lockToken, mediaId);
    return Response.json({
      success: true,
      mediaId,
      username: account.username,
      contentType: post.contentType,
      mediaCount: media.length,
      quota: { ...limit, remaining: Math.max(0, limit.remaining - 1) },
      post: publishedPost,
    });
  } catch (error) {
    const message = safePublicError(error);
    try { await markSocialPublishFailure(post.id, lockToken, message); } catch {}
    console.error(`[Instagram Publish] ${message}`);
    return Response.json({ error: message }, { status: 502 });
  }
}
