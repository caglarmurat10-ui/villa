import { createSocialPost, listSocialPosts } from "@/lib/social-db";
import { replaceSocialPostMedia } from "@/lib/social-media-store";
import { socialDriveMedia } from "@/lib/social-drive-media";
import { META_ACTIVE_TARGETS } from "@/lib/social-account-policy";
import type { SocialPost, Villa } from "@/lib/types";

export const dynamic = "force-dynamic";

function todayIstanbul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

function caption(villa: Villa) {
  return villa === "Safira"
    ? "Villa Safira | Patara, Kaş 🌿\n\nDoğayla iç içe, sakin ve özel bir tatil için Villa Safira. Uygun tarihler ve rezervasyon bilgisi için mesaj gönderebilirsiniz.\n\n#Kaş #Patara #VillaSafira #villatatili #kiralıkvilla"
    : "Villa Destan | Patara, Kaş 🌿\n\nHuzurlu, bağımsız ve keyifli bir villa tatili için Villa Destan. Uygun tarihler ve rezervasyon bilgisi için mesaj gönderebilirsiniz.\n\n#Kaş #Patara #VillaDestan #villatatili #kiralıkvilla";
}

function isSmokePlan(post: SocialPost, scheduledDate: string) {
  const activeTarget = META_ACTIVE_TARGETS.some((target) => target.villa === post.villa && target.platform === post.platform);
  return activeTarget &&
    post.scheduledDate === scheduledDate &&
    post.contentType === "Gönderi" &&
    post.caption === caption(post.villa);
}

function serialize(post: SocialPost) {
  return {
    id: post.id,
    villa: post.villa,
    platform: post.platform,
    status: post.status,
    approvalStatus: post.approvalStatus,
    scheduledDate: post.scheduledDate,
    caption: post.caption,
    mediaUrl: post.mediaUrl,
    platformPostId: post.platformPostId ?? null,
    lastPublishError: post.lastPublishError ?? null,
    publishAttemptCount: post.publishAttemptCount ?? 0,
  };
}

export async function GET() {
  const scheduledDate = todayIstanbul();
  const posts = await listSocialPosts(100);
  const plans = posts
    .filter((post) => isSmokePlan(post, scheduledDate))
    .sort((a, b) => `${a.villa}-${a.platform}`.localeCompare(`${b.villa}-${b.platform}`))
    .map(serialize);

  return Response.json({
    scheduledDate,
    plans,
    count: plans.length,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const scheduledDate = todayIstanbul();
  const existing = await listSocialPosts(100);
  const prepared: Array<{ id: string; villa: Villa; platform: "Instagram" | "Facebook"; created: boolean }> = [];

  for (const { villa, platform } of META_ACTIVE_TARGETS) {
    const asset = socialDriveMedia.find((item) => item.villa === villa && item.mediaKind === "image");
    if (!asset) return Response.json({ error: `Villa ${villa} için doğrulanmış test görseli bulunamadı.` }, { status: 409 });
    const mediaUrl = `${origin}${asset.proxyPath}`;
    const postCaption = caption(villa);

    const found = existing.find((post) =>
      post.villa === villa &&
      post.platform === platform &&
      post.contentType === "Gönderi" &&
      post.scheduledDate === scheduledDate &&
      post.caption === postCaption &&
      post.status === "Planlandı",
    );

    if (found) {
      prepared.push({ id: found.id, villa, platform, created: false });
      continue;
    }

    const post = await createSocialPost({
      villa,
      platform,
      contentType: "Gönderi",
      scheduledDate,
      caption: postCaption,
      mediaUrl,
      mediaUrls: [mediaUrl],
    });
    await replaceSocialPostMedia(post.id, [{ mediaUrl, kind: "image" }]);
    prepared.push({ id: post.id, villa, platform, created: true });
  }

  const current = await listSocialPosts(100);
  const plans = current.filter((post) => isSmokePlan(post, scheduledDate)).map(serialize);

  return Response.json({
    success: true,
    scheduledDate,
    prepared,
    plans,
    createdCount: prepared.filter((item) => item.created).length,
    existingCount: prepared.filter((item) => !item.created).length,
    approvalStatus: "İnsan onayı",
    message: `${META_ACTIVE_TARGETS.length} kontrollü yayın planı hazırlandı. Tüm aktif Meta hedefleri kapsanır. Hiçbiri insan onayı olmadan Meta'ya gönderilmez.`,
  });
}
