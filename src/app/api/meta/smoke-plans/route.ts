import { createSocialPost, listSocialPosts } from "@/lib/social-db";
import { replaceSocialPostMedia } from "@/lib/social-media-store";
import { socialDriveMedia } from "@/lib/social-drive-media";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";

const villas: Villa[] = ["Safira", "Destan"];
const platforms = ["Instagram", "Facebook"] as const;

function todayIstanbul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

function caption(villa: Villa) {
  return villa === "Safira"
    ? "Villa Safira | Patara, Kaş 🌿\n\nDoğayla iç içe, sakin ve özel bir tatil için Villa Safira. Uygun tarihler ve rezervasyon bilgisi için mesaj gönderebilirsiniz.\n\n#Kaş #Patara #VillaSafira #villatatili #kiralıkvilla"
    : "Villa Destan | Patara, Kaş 🌿\n\nHuzurlu, bağımsız ve keyifli bir villa tatili için Villa Destan. Uygun tarihler ve rezervasyon bilgisi için mesaj gönderebilirsiniz.\n\n#Kaş #Patara #VillaDestan #villatatili #kiralıkvilla";
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const scheduledDate = todayIstanbul();
  const existing = await listSocialPosts(100);
  const prepared: Array<{ id: string; villa: Villa; platform: "Instagram" | "Facebook"; created: boolean }> = [];

  for (const villa of villas) {
    const asset = socialDriveMedia.find((item) => item.villa === villa && item.mediaKind === "image");
    if (!asset) return Response.json({ error: `Villa ${villa} için doğrulanmış test görseli bulunamadı.` }, { status: 409 });
    const mediaUrl = `${origin}${asset.proxyPath}`;
    const postCaption = caption(villa);

    for (const platform of platforms) {
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
  }

  return Response.json({
    success: true,
    scheduledDate,
    prepared,
    createdCount: prepared.filter((item) => item.created).length,
    existingCount: prepared.filter((item) => !item.created).length,
    approvalStatus: "İnsan onayı",
    message: "Dört kontrollü yayın planı hazırlandı. Hiçbiri insan onayı olmadan Meta'ya gönderilmez.",
  });
}
