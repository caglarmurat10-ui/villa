import type { SocialPostInput } from "./schema";
import { socialContentTemplates } from "./social-content-library";
import { seedSocialPosts } from "./social-db";

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export async function ensureDefaultSocialPlan() {
  const today = istanbulToday();
  const inputs: SocialPostInput[] = [];

  for (const template of socialContentTemplates) {
    if (!template.mediaResolved || !template.mediaUrl || template.scheduledDate < today) continue;

    inputs.push({
      villa: template.villa,
      platform: "Instagram",
      contentType: template.contentType,
      scheduledDate: template.scheduledDate,
      caption: template.caption,
      mediaUrl: template.mediaUrl,
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
        mediaUrl: template.mediaUrl,
      });
    }
  }

  return seedSocialPosts(inputs);
}
