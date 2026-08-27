import { validateManagedInstagramMedia } from "@/lib/instagramMedia";
import {
  createScheduledInstagramPost,
  type CreateScheduledPostInput,
} from "@/lib/instagramSchedule";
import { INSTAGRAM_TIMEZONE, validateScheduledDate } from "@/lib/instagramTime";
import { getInstagramAccountFromEnv } from "@/lib/meta-store";
import { createAvailabilityCaption } from "@/lib/social-templates";
import {
  attachScheduledCampaign,
  availabilityPriceText,
  createCampaign,
  getBrandProfile,
  getCampaign,
  getSocialSettings,
  ignoreAvailability,
  listAvailability,
  listCampaigns,
  listMediaLibrary,
  socialOperationsDb,
  suggestLibraryMedia,
} from "@/lib/socialOperationsDb";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";

function villa(value: unknown): Villa | null {
  return value === "Destan" || value === "Safira" ? value : null;
}

export async function GET() {
  try {
    const { db } = await socialOperationsDb();
    return Response.json({ campaigns: await listCampaigns(db) });
  } catch {
    return Response.json({ error: "Kampanyalar yüklenemedi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const { db, env } = await socialOperationsDb();
    if (body.action === "ignore") {
      const selectedVilla = villa(body.villa);
      if (!selectedVilla || typeof body.startDate !== "string" || typeof body.endDate !== "string") {
        throw new Error("Yoksayılacak müsaitlik geçersiz.");
      }
      await ignoreAvailability(db, selectedVilla, body.startDate, body.endDate);
      return Response.json({ ok: true });
    }
    if (body.action === "create") {
      const selectedVilla = villa(body.villa);
      if (!selectedVilla || typeof body.startDate !== "string" || typeof body.endDate !== "string") {
        throw new Error("Müsaitlik aralığı geçersiz.");
      }
      const validGap = (await listAvailability(db, 180)).find((gap) =>
        gap.villa === selectedVilla && gap.startDate === body.startDate && gap.endDate === body.endDate);
      if (!validGap) throw new Error("Bu tarih aralığı artık müsait değil.");
      const [settings, brand, media] = await Promise.all([
        getSocialSettings(db, selectedVilla), getBrandProfile(db, selectedVilla), suggestLibraryMedia(db, selectedVilla),
      ]);
      const generated = createAvailabilityCaption(validGap, {
        whatsappCta: settings.whatsappCta, websiteCta: settings.websiteCta, website: brand.website,
        priceText: settings.includePrice
          ? await availabilityPriceText(db, selectedVilla, validGap.startDate, validGap.endDate)
          : null,
      });
      const campaign = await createCampaign(db, {
        villa: selectedVilla, campaignType: validGap.isLastMinute ? "last-minute" : "availability",
        availabilityStart: validGap.startDate, availabilityEnd: validGap.endDate, nights: validGap.nights,
        mediaIds: media ? [media.id] : [], caption: generated.caption, templateId: generated.templateId,
        source: body.source === "automation" ? "automation" : "availability", contentCategory: "Müsaitlik",
      });
      return Response.json({ campaign, suggestedMedia: media }, { status: 201 });
    }
    if (body.action === "schedule") {
      if (typeof body.campaignId !== "string" || typeof body.scheduledAt !== "string") {
        throw new Error("Kampanya ve yayın zamanı gerekli.");
      }
      const campaign = await getCampaign(db, body.campaignId);
      if (!campaign || campaign.status !== "draft") throw new Error("Planlanabilir kampanya bulunamadı.");
      const account = await getInstagramAccountFromEnv(env, campaign.villa);
      if (!account) throw new Error("Bu villa için Instagram hesabı bağlı değil.");
      const media = (await listMediaLibrary(db, campaign.villa)).filter((item) => campaign.mediaIds.includes(item.id) && item.active);
      if (!media.length) throw new Error("Kampanyayı planlamak için aktif medya seçin.");
      const scheduledAt = validateScheduledDate(body.scheduledAt, INSTAGRAM_TIMEZONE, new Date());
      const type = media[0].mediaType === "VIDEO" ? "REELS" as const : media.length > 1 ? "CAROUSEL" as const : "IMAGE" as const;
      const input: CreateScheduledPostInput = { villa: campaign.villa, type, mediaUrls: media.map((item) => item.publicUrl),
        caption: campaign.caption, shareToFeed: true, scheduledAt, timezone: INSTAGRAM_TIMEZONE };
      await validateManagedInstagramMedia(env, input, { scheduledAt });
      const scheduled = await createScheduledInstagramPost(db, input);
      if (!scheduled) throw new Error("Planlı yayın oluşturulamadı.");
      await attachScheduledCampaign(db, campaign.id, scheduled.id);
      return Response.json({ campaign: await getCampaign(db, campaign.id), scheduled }, { status: 201 });
    }
    throw new Error("Kampanya işlemi geçersiz.");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Kampanya işlemi başarısız." }, { status: 400 });
  }
}
