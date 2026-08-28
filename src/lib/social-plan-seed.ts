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
    const mediaUrl = new URL(template.mediaUrl, `${baseUrl}/`).toString();

    inputs.push({
      villa: template.villa,
      platform: "Instagram",
      contentType: template.contentType,
      scheduledDate: template.scheduledDate,
      caption: template.caption,
      mediaUrl,
    });

    // Current Facebook direct publisher supports image/text Feed posts.
    // Feed + Carousel templates both map to SocialContentType "Gönderi".
    if (template.contentType === "Gönderi") {
      inputs.push({
        villa: template.villa,
        platform: "Facebook",
        contentType: "Gönderi",
        scheduledDate: template.scheduledDate,
        caption: template.caption,
        mediaUrl,
      });
    }
  }

  return seedSocialPosts(inputs);
}
