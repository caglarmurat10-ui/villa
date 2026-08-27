import { validateManagedInstagramMedia } from "./instagramMedia";
import {
  createScheduledInstagramPost,
  type CreateScheduledPostInput,
} from "./instagramSchedule";
import { INSTAGRAM_TIMEZONE, istanbulLocalToUtc } from "./instagramTime";
import { getInstagramAccountFromEnv } from "./meta-store";
import { addDays } from "./social-availability";
import { pilotLimitDecision } from "./social-rules";
import { createAvailabilityCaption } from "./social-templates";
import {
  attachScheduledCampaign,
  availabilityPriceText,
  createCampaign,
  getBrandProfile,
  getSocialSettings,
  listAvailability,
  listMediaLibrary,
  suggestLibraryMedia,
} from "./socialOperationsDb";
import type { Villa } from "./types";

function istanbulToday(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now);
}

export function pilotEnabledDecision(enabled: boolean) {
  return enabled ? { shouldSchedule: true } as const : { shouldSchedule: false } as const;
}

export function pilotPrerequisiteDecision(input: {
  enabled: boolean;
  hasAccount: boolean;
  hasAvailability: boolean;
  hasMedia: boolean;
  hasSlot: boolean;
}) {
  if (!input.enabled) return { allowed: false, reason: "disabled" } as const;
  if (!input.hasAccount) return { allowed: false, reason: "account-missing" } as const;
  if (!input.hasAvailability) return { allowed: false, reason: "availability-missing" } as const;
  if (!input.hasMedia) return { allowed: false, reason: "media-missing" } as const;
  if (!input.hasSlot) return { allowed: false, reason: "limit" } as const;
  return { allowed: true, reason: null } as const;
}

async function findPilotSlot(env: CloudflareEnv, villa: Villa, preferredTimes: string[], weeklyTarget: number, now: Date) {
  const result = await env.DB.prepare(`SELECT villa,scheduled_at FROM instagram_scheduled_posts
    WHERE status IN ('scheduled','processing','published') AND scheduled_at>=? AND scheduled_at<=?
    ORDER BY scheduled_at`).bind(new Date(now.getTime() - 7 * 86_400_000).toISOString(),
      new Date(now.getTime() + 14 * 86_400_000).toISOString()).all<{ villa: Villa; scheduled_at: string }>();
  const villaTimes = result.results.filter((item) => item.villa === villa).map((item) => item.scheduled_at);
  const allTimes = result.results.map((item) => Date.parse(item.scheduled_at));
  const today = istanbulToday(now);
  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const date = addDays(today, dayOffset);
    for (const time of preferredTimes) {
      const candidate = istanbulLocalToUtc(`${date}T${time}`);
      if (candidate.getTime() < now.getTime() + 10 * 60 * 1000) continue;
      if (!pilotLimitDecision(villaTimes, candidate.toISOString(), weeklyTarget).allowed) continue;
      if (allTimes.some((value) => Math.abs(candidate.getTime() - value) < 45 * 60 * 1000)) continue;
      return candidate;
    }
  }
  return null;
}

export async function runSocialPilot(env: CloudflareEnv, now = new Date()) {
  const results: Array<{ villa: Villa; status: string }> = [];
  for (const villa of ["Destan", "Safira"] as const) {
    const settings = await getSocialSettings(env.DB, villa);
    if (!pilotEnabledDecision(settings.pilotEnabled).shouldSchedule) {
      results.push({ villa, status: "disabled" });
      continue;
    }
    const account = await getInstagramAccountFromEnv(env, villa);
    if (!account) {
      results.push({ villa, status: "account-missing" });
      continue;
    }
    const slot = await findPilotSlot(env, villa, settings.preferredTimes, settings.weeklyTarget, now);
    if (!slot) {
      results.push({ villa, status: "limit" });
      continue;
    }
    const gaps = (await listAvailability(env.DB, settings.maxCampaignDays))
      .filter((gap) => gap.villa === villa)
      .sort((left, right) => Number(right.priority === "high") - Number(left.priority === "high") ||
        Number(right.isLastMinute) - Number(left.isLastMinute) || left.startDate.localeCompare(right.startDate));
    const gap = gaps[0];
    const media = await suggestLibraryMedia(env.DB, villa);
    if (!gap || !media) {
      results.push({ villa, status: !gap ? "availability-missing" : "media-missing" });
      continue;
    }
    const brand = await getBrandProfile(env.DB, villa);
    const generated = createAvailabilityCaption(gap, { whatsappCta: settings.whatsappCta,
      websiteCta: settings.websiteCta, website: brand.website,
      priceText: settings.includePrice
        ? await availabilityPriceText(env.DB, villa, gap.startDate, gap.endDate)
        : null });
    try {
      const campaign = await createCampaign(env.DB, { villa, campaignType: gap.isLastMinute ? "last-minute" : "availability",
        availabilityStart: gap.startDate, availabilityEnd: gap.endDate, nights: gap.nights,
        mediaIds: [media.id], caption: generated.caption, templateId: generated.templateId,
        source: "automation", contentCategory: "Müsaitlik" });
      if (!campaign) throw new Error("campaign-create-failed");
      const libraryItem = (await listMediaLibrary(env.DB, villa)).find((item) => item.id === media.id && item.active);
      if (!libraryItem) throw new Error("media-missing");
      const input: CreateScheduledPostInput = { villa, type: "IMAGE", mediaUrls: [libraryItem.publicUrl], caption: campaign.caption,
        shareToFeed: true, scheduledAt: slot, timezone: INSTAGRAM_TIMEZONE };
      await validateManagedInstagramMedia(env, input, { scheduledAt: slot });
      const scheduled = await createScheduledInstagramPost(env.DB, input);
      if (!scheduled) throw new Error("schedule-create-failed");
      await attachScheduledCampaign(env.DB, campaign.id, scheduled.id);
      results.push({ villa, status: "scheduled" });
    } catch {
      results.push({ villa, status: "skipped" });
    }
  }
  return results;
}
