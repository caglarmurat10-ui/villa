import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { SocialPostInput } from "./schema";
import { socialContentTemplates } from "./social-content-library";
import { seedSocialPosts } from "./social-db";

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

async function appBaseUrl() {
  let configured = process.env.APP_BASE_URL ?? "";
  try {
    const { env } = await getCloudflareContext({ async: true });
    configured = env.APP_BASE_URL || configured;
  } catch {}
  return (configured || "https://villa-yonetim.caglarmurat10.workers.dev").replace(/\/+$/, "");
}

export async function ensureDefaultSocialPlan() {
  const today = istanbulToday();
  const baseUrl = await appBaseUrl();
  const inputs: SocialPostInput[] = [];

  for (const template of socialContentTemplates) {
    if (!template.mediaResolved || !template.mediaUrl || template.scheduledDate < today) continue;
    if (template.contentType === "Reels" && template.mediaKind !== "video") continue;
    const mediaUrls = (template.mediaUrls.length ? template.mediaUrls : [template.mediaUrl])
      .map((url) => new URL(url, `${baseUrl}/`).toString())
      .slice(0, 10);
    const mediaUrl = mediaUrls[0] ?? "";
    if (!mediaUrl) continue;

    inputs.push({
      villa: template.villa,
      platform: "Instagram",
      contentType: template.contentType,
      scheduledDate: template.scheduledDate,
      caption: template.caption,
      mediaUrl,
      mediaUrls,
    });

    if (template.contentType === "Gönderi" || (template.contentType === "Reels" && template.mediaKind === "video")) {
      inputs.push({
        villa: template.villa,
        platform: "Facebook",
        contentType: template.contentType,
        scheduledDate: template.scheduledDate,
        caption: template.caption,
        mediaUrl,
        mediaUrls,
      });
    }
  }

  return seedSocialPosts(inputs);
}
