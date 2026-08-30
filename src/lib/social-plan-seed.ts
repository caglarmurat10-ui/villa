import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { SocialPostInput } from "./schema";
import { socialContentTemplates } from "./social-content-library";
import { seedSocialPosts } from "./social-db";
import { approvedProxyMediaAsset } from "./social-drive-media";
import { listSocialPostMedia, replaceSocialPostMedia } from "./social-media-store";

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

function planIdentity(input: Pick<SocialPostInput, "villa" | "platform" | "contentType" | "scheduledDate" | "caption">) {
  return `${input.villa}\u001f${input.platform}\u001f${input.contentType}\u001f${input.scheduledDate}\u001f${input.caption}`;
}

async function syncSeededCarouselMedia(inputs: SocialPostInput[], baseUrl: string, today: string) {
  const carouselInputs = inputs.filter((input) => [...new Set(input.mediaUrls ?? [])].length > 1);
  if (carouselInputs.length === 0) return 0;

  const { env } = await getCloudflareContext({ async: true });
  const rows = await env.DB.prepare(`SELECT id, villa, platform, content_type, scheduled_date, caption
    FROM social_posts
    WHERE status = 'Planlandı' AND scheduled_date >= ? AND content_type = 'Gönderi'`)
    .bind(today)
    .all<{
      id: string;
      villa: SocialPostInput["villa"];
      platform: SocialPostInput["platform"];
      content_type: SocialPostInput["contentType"];
      scheduled_date: string;
      caption: string;
    }>();

  const byIdentity = new Map(rows.results.map((row) => [planIdentity({
    villa: row.villa,
    platform: row.platform,
    contentType: row.content_type,
    scheduledDate: row.scheduled_date,
    caption: row.caption,
  }), row.id]));

  const allowedOrigins = [
    new URL(baseUrl).origin,
    "https://villa-yonetim.caglarmurat10.workers.dev",
  ];
  let synced = 0;

  for (const input of carouselInputs) {
    const postId = byIdentity.get(planIdentity(input));
    if (!postId) continue;

    const mediaUrls = [...new Set(input.mediaUrls ?? [])].slice(0, 10);
    const desired = mediaUrls.map((mediaUrl) => {
      const asset = approvedProxyMediaAsset(input.villa, mediaUrl, allowedOrigins);
      return asset ? { mediaUrl, kind: asset.mediaKind } : null;
    });
    if (desired.some((item) => item === null)) continue;

    const verified = desired.filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (verified.length < 2) continue;

    const current = await listSocialPostMedia(postId);
    const unchanged = current.length === verified.length && current.every((item, index) =>
      item.mediaUrl === verified[index]?.mediaUrl && item.kind === verified[index]?.kind,
    );
    if (unchanged) continue;

    await replaceSocialPostMedia(postId, verified);
    synced += 1;
  }

  return synced;
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

  const result = await seedSocialPosts(inputs);
  const mediaSynced = await syncSeededCarouselMedia(inputs, baseUrl, today);
  return { ...result, mediaSynced };
}
