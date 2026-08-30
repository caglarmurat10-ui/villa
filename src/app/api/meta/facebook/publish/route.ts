import { z } from "zod";
import { publishFacebookPost } from "@/lib/facebook";
import { publishFacebookPhotoCarousel, publishFacebookReel } from "@/lib/facebook-publish";
import { getFacebookCredentials } from "@/lib/meta-store";
import {
  claimSocialPublishAttempt,
  getSocialPost,
  markSocialPublishFailure,
  markSocialPublishSuccess,
} from "@/lib/social-db";
import { approvedProxyMediaAsset } from "@/lib/social-drive-media";
import { listSocialPostMedia, type SocialPostMediaItem } from "@/lib/social-media-store";

const schema = z.object({ postId: z.string().trim().min(1, "Paylaşım kimliği gerekli.") });

function safePublicError(error: unknown) {
  const message = error instanceof Error && error.message ? error.message : "Facebook yayını başarısız.";
  return message
    .replace(
      /(access_token|client_secret|authorization_code|short_lived_token|long_lived_token|code|fb_exchange_token)=([^&\s]+)/gi,
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
  if (post.platform !== "Facebook") return Response.json({ error: "Bu endpoint yalnızca Facebook paylaşımları içindir." }, { status: 400 });
  if (post.status !== "Planlandı") return Response.json({ error: "Bu paylaşım daha önce yayınlanmış." }, { status: 409 });
  if (post.approvalStatus !== "Onaylandı") return Response.json({ error: "Facebook yayını için önce insan onayı verilmelidir." }, { status: 409 });
  if (post.contentType === "Hikâye") {
    return Response.json({ error: "Facebook Story otomatik yayını bu Meta API akışında güvenli olarak etkin değil. Story planı manuel yayın için korunmalıdır." }, { status: 409 });
  }

  const allowedOrigins = [new URL(request.url).origin, "https://villa-yonetim.caglarmurat10.workers.dev"];
  let media: SocialPostMediaItem[] = await listSocialPostMedia(post.id);
  if (media.length === 0 && post.mediaUrl) {
    const asset = approvedProxyMediaAsset(post.villa, post.mediaUrl, allowedOrigins);
    if (asset) media = [{ position: 0, mediaUrl: post.mediaUrl, kind: asset.mediaKind }];
  }
  for (const item of media) {
    const asset = approvedProxyMediaAsset(post.villa, item.mediaUrl, allowedOrigins);
    if (!asset || asset.mediaKind !== item.kind) {
      return Response.json({ error: `Villa ${post.villa} için doğrulanmamış veya medya türü değişmiş dosya Facebook'a gönderilemez.` }, { status: 409 });
    }
  }

  if (post.contentType === "Reels" && (media.length !== 1 || media[0]?.kind !== "video")) {
    return Response.json({ error: "Facebook Reels için tek bir doğrulanmış video gerekli." }, { status: 409 });
  }
  if (post.contentType === "Gönderi" && media.length > 1 && media.some((item) => item.kind !== "image")) {
    return Response.json({ error: "Facebook çoklu Gönderi akışında şimdilik yalnız fotoğraf Carousel desteklenir." }, { status: 409 });
  }
  if (post.contentType === "Gönderi" && media.length === 1 && media[0]?.kind === "video") {
    return Response.json({ error: "Tek Facebook videosu Reels olarak planlanmalıdır." }, { status: 409 });
  }

  const account = await getFacebookCredentials(post.villa).catch((error) => {
    console.error(`[Facebook Credentials] ${safePublicError(error)}`);
    return null;
  });
  if (!account) return Response.json({ error: `Villa ${post.villa} Facebook Sayfası bağlı değil veya bağlantısı yenilenmeli.` }, { status: 409 });

  const claim = await claimSocialPublishAttempt(post.id);
  if (!claim) {
    return Response.json({ error: "Bu paylaşım başka bir yayın işlemi tarafından işleniyor veya artık yayına uygun değil." }, { status: 409 });
  }

  const { lockToken } = claim;
  try {
    let facebookPostId: string;
    if (post.contentType === "Reels") {
      facebookPostId = await publishFacebookReel(account.accountId, account.accessToken, media[0].mediaUrl, post.caption);
    } else if (media.length > 1) {
      facebookPostId = await publishFacebookPhotoCarousel(
        account.accountId,
        account.accessToken,
        post.caption,
        media.map((item) => item.mediaUrl),
      );
    } else {
      facebookPostId = await publishFacebookPost(account.accountId, account.accessToken, post.caption, media[0]?.mediaUrl);
    }

    const publishedPost = await markSocialPublishSuccess(post.id, lockToken, facebookPostId);
    return Response.json({
      success: true,
      facebookPostId,
      username: account.username,
      contentType: post.contentType,
      mediaCount: media.length,
      post: publishedPost,
    });
  } catch (error) {
    const message = safePublicError(error);
    try { await markSocialPublishFailure(post.id, lockToken, message); } catch {}
    console.error(`[Facebook Publish] ${message}`);
    return Response.json({ error: message }, { status: 502 });
  }
}
