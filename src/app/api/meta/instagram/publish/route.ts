import { z } from "zod";
import { getInstagramPublishingLimit, publishInstagramImage } from "@/lib/meta";
import { getInstagramCredentials } from "@/lib/meta-store";
import { getSocialPost, updateSocialPostStatus } from "@/lib/social-db";
import { isApprovedProxyMediaUrl } from "@/lib/social-drive-media";

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
  if (post.contentType !== "Gönderi") return Response.json({ error: "Bu yayın akışı yalnızca Instagram görsel gönderileri içindir. Reels ve Hikâye için video/özel medya akışı kullanılmalıdır." }, { status: 409 });
  if (post.status !== "Planlandı") return Response.json({ error: "Bu paylaşım daha önce yayınlanmış." }, { status: 409 });
  if (post.approvalStatus !== "Onaylandı") return Response.json({ error: "Instagram yayını için önce insan onayı verilmelidir." }, { status: 409 });
  if (!post.mediaUrl) return Response.json({ error: "Instagram yayını için görsel bağlantısı gerekli." }, { status: 409 });

  const allowedOrigins = [new URL(request.url).origin, "https://villa-yonetim.caglarmurat10.workers.dev"];
  if (!isApprovedProxyMediaUrl(post.villa, post.mediaUrl, allowedOrigins)) {
    return Response.json({ error: `Villa ${post.villa} için doğrulanmamış medya Instagram'a gönderilemez.` }, { status: 409 });
  }

  try {
    const account = await getInstagramCredentials(post.villa);
    if (!account) return Response.json({ error: `Villa ${post.villa} Instagram hesabı bağlı değil.` }, { status: 409 });

    const limit = await getInstagramPublishingLimit(account.accountId, account.accessToken);
    if (limit.remaining <= 0) {
      return Response.json({
        error: `Instagram API yayın kotası dolu (${limit.quotaUsage}/${limit.quotaTotal}). Kota yenilenene kadar yayın gönderilmedi.`,
        quota: limit,
      }, { status: 429 });
    }

    const mediaId = await publishInstagramImage(
      account.accountId,
      account.accessToken,
      post.mediaUrl,
      post.caption,
      `Villa ${post.villa}, Patara / Kaş özel havuzlu villa`,
    );
    const publishedPost = await updateSocialPostStatus(post.id, "Yayınlandı");

    return Response.json({
      success: true,
      mediaId,
      username: account.username,
      quota: { ...limit, remaining: Math.max(0, limit.remaining - 1) },
      post: publishedPost,
    });
  } catch (error) {
    const message = safePublicError(error);
    console.error(`[Instagram Publish] ${message}`);
    return Response.json({ error: message }, { status: 502 });
  }
}
