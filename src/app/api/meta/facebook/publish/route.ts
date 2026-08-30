import { z } from "zod";
import { publishFacebookPost } from "@/lib/facebook";
import { getFacebookCredentials } from "@/lib/meta-store";
import {
  beginSocialPublishAttempt,
  getSocialPost,
  markSocialPublishFailure,
  markSocialPublishSuccess,
} from "@/lib/social-db";
import { isApprovedProxyMediaUrl } from "@/lib/social-drive-media";

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
  if (post.contentType !== "Gönderi") {
    return Response.json({ error: "Facebook Hikâye/Reels doğrudan yayını henüz bu medya akışında desteklenmiyor. Bu kayıt Gönderi olarak hazırlanmalıdır." }, { status: 409 });
  }
  if (post.mediaUrl) {
    const allowedOrigins = [new URL(request.url).origin, "https://villa-yonetim.caglarmurat10.workers.dev"];
    if (!isApprovedProxyMediaUrl(post.villa, post.mediaUrl, allowedOrigins)) {
      return Response.json({ error: `Villa ${post.villa} için doğrulanmamış medya Facebook'a gönderilemez.` }, { status: 409 });
    }
  }

  let attemptStarted = false;
  try {
    const account = await getFacebookCredentials(post.villa);
    if (!account) return Response.json({ error: `Villa ${post.villa} Facebook Sayfası bağlı değil.` }, { status: 409 });

    await beginSocialPublishAttempt(post.id);
    attemptStarted = true;

    const facebookPostId = await publishFacebookPost(account.accountId, account.accessToken, post.caption, post.mediaUrl || undefined);
    const publishedPost = await markSocialPublishSuccess(post.id, facebookPostId);
    return Response.json({ success: true, facebookPostId, username: account.username, post: publishedPost });
  } catch (error) {
    const message = safePublicError(error);
    if (attemptStarted) {
      try { await markSocialPublishFailure(post.id, message); } catch {}
    }
    console.error(`[Facebook Publish] ${message}`);
    return Response.json({ error: message }, { status: 502 });
  }
}
