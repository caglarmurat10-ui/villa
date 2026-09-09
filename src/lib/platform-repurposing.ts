// Çok-platformlu içerik yeniden paketleme (bölüm 5) - TEK bir gerçek villa fotoğrafı/videosundan,
// her platform için AYRI (aynı metnin kopyası değil) title/caption/CTA/hashtag/UTM/oran üretir.
// Yalnız REAL_UPLOAD medya kabul edilir - AI_GENERATED/OTHER veya villa eşleşmeyen medya fail-closed
// reddedilir (aynı gate: social-drive-media.ts approvedProxyMediaAsset ile aynı disiplin, burada
// fileId üzerinden çalışır çünkü bu paketler bir HTTP request/origin'e değil doğrudan bir medya
// kaydına bağlanır).
import { resolveDriveMediaById, type DriveMediaKind } from "./social-drive-media";
import { VILLAS, type VillaSlug } from "./villa-content";
import { buildUtmUrl, normalizeUtmToken, PLATFORM_UTM_DEFAULTS } from "./utm";
import type { Villa } from "./types";

const SITE_ORIGIN = "https://safiradestan.com";

export const ORGANIC_PLATFORMS = ["instagram", "facebook", "youtube_shorts", "tiktok", "pinterest"] as const;
export type OrganicPlatform = (typeof ORGANIC_PLATFORMS)[number];

export type AspectRatio = "1:1" | "4:5" | "9:16" | "2:3" | "16:9";

export interface PlatformPackage {
  platform: OrganicPlatform;
  title: string | null; // YouTube Shorts/Pinterest başlık gerektirir; IG/FB/TikTok null kalabilir
  caption: string;
  cta: string;
  hashtags: string[];
  utmUrl: string;
  recommendedRatio: AspectRatio;
  mediaKind: DriveMediaKind;
  sourceFileId: string;
}

export interface BuildPlatformPackagesInput {
  villa: Villa;
  mediaFileId: string;
  theme: string; // örn. "Havuz", "Bahçe", "Patara" - yalnız metin varyasyonu için, doğrulanmış veri gerektirmez
  campaignId: string;
  landingPath?: string; // varsayılan: villanın kendi sayfası
}

export type BuildPlatformPackagesResult =
  | { ok: true; packages: PlatformPackage[] }
  | { ok: false; error: string };

function villaSlugFor(villa: Villa): VillaSlug {
  return villa === "Safira" ? "villa-safira" : "villa-destan";
}

const BASE_HASHTAGS = ["patara", "kaş", "antalya"];

function villaHashtag(villa: Villa): string {
  return villa === "Safira" ? "villasafirapatara" : "villadestanpatara";
}

export function buildPlatformPackages(input: BuildPlatformPackagesInput): BuildPlatformPackagesResult {
  const asset = resolveDriveMediaById(input.mediaFileId);
  if (!asset) return { ok: false, error: "Bilinmeyen medya kaydı - paket üretilemez (fail closed)." };
  if (asset.villa !== input.villa) return { ok: false, error: `Bu medya Villa ${asset.villa} için kayıtlı, Villa ${input.villa} kampanyasında kullanılamaz (property isolation).` };
  if (asset.sourceOrigin !== "REAL_UPLOAD") return { ok: false, error: `Medya kaynağı '${asset.sourceOrigin}' - yalnız REAL_UPLOAD medya otomatik paket/yayın için uygundur.` };

  const villaContent = VILLAS[villaSlugFor(input.villa)];
  const landingPath = input.landingPath ?? `/${villaSlugFor(input.villa)}`;
  const theme = input.theme.trim();
  const villaTag = villaHashtag(input.villa);

  function utm(platform: OrganicPlatform, content: string) {
    const defaults = PLATFORM_UTM_DEFAULTS[platform];
    return buildUtmUrl({ path: landingPath, source: defaults.source, medium: defaults.medium, campaign: input.campaignId, content });
  }

  const packages: PlatformPackage[] = [
    {
      platform: "instagram",
      title: null,
      caption: `${theme} — ${villaContent.name}, Patara.\n\n${villaContent.quote}\n\n${villaContent.quickFacts.summary}`,
      cta: "Profildeki linkten tarih ve fiyat kontrol edin.",
      hashtags: [villaTag, ...BASE_HASHTAGS, "villakiralama", "pataravilla"],
      utmUrl: utm("instagram", normalizeUtmToken(theme)),
      recommendedRatio: asset.mediaKind === "video" ? "9:16" : "4:5",
      mediaKind: asset.mediaKind,
      sourceFileId: asset.fileId,
    },
    {
      platform: "facebook",
      title: null,
      caption: `${villaContent.name} — ${theme}\n\n${villaContent.description}\n\nDoğrudan rezervasyon için canlı müsaitlik ve dönemsel fiyatı sitemizden kontrol edebilirsiniz.`,
      cta: "Detaylar ve müsaitlik için siteyi ziyaret edin.",
      hashtags: [villaTag, ...BASE_HASHTAGS],
      utmUrl: utm("facebook", normalizeUtmToken(theme)),
      recommendedRatio: asset.mediaKind === "video" ? "16:9" : "1:1",
      mediaKind: asset.mediaKind,
      sourceFileId: asset.fileId,
    },
    {
      platform: "youtube_shorts",
      title: `${villaContent.name} — ${theme} | Patara Kaş Özel Havuzlu Villa`,
      caption: `${villaContent.name}'da ${theme.toLowerCase()}. Patara, Kaş'ta özel havuzlu villa tatili.\n\n${villaContent.quickFacts.summary}\n\nDetaylar ve rezervasyon: ${SITE_ORIGIN}${landingPath}`,
      cta: "Rezervasyon ve detaylar için açıklamadaki linke bakın.",
      hashtags: ["shorts", villaTag, ...BASE_HASHTAGS],
      utmUrl: utm("youtube_shorts", normalizeUtmToken(theme)),
      recommendedRatio: "9:16",
      mediaKind: asset.mediaKind,
      sourceFileId: asset.fileId,
    },
    {
      platform: "tiktok",
      title: null,
      caption: `${theme} moduna geçin 🌿 ${villaContent.name}, Patara'da özel havuzlu bir kaçış.`,
      cta: "Linki bio'dan rezervasyon için kullanın.",
      hashtags: [villaTag, ...BASE_HASHTAGS, "tatil"],
      utmUrl: utm("tiktok", normalizeUtmToken(theme)),
      recommendedRatio: "9:16",
      mediaKind: asset.mediaKind,
      sourceFileId: asset.fileId,
    },
    {
      platform: "pinterest",
      title: `${villaContent.name} — Patara Kaş Özel Havuzlu Villa | ${theme}`,
      caption: `${villaContent.name}, Patara/Kaş'ta özel havuzlu bir villa. ${villaContent.quickFacts.summary} Doğrudan rezervasyon ve canlı müsaitlik ${SITE_ORIGIN}${landingPath} adresinde.`,
      cta: "Pin'e tıklayıp detayları ve müsaitliği inceleyin.",
      hashtags: [villaTag, ...BASE_HASHTAGS, "villatatili"],
      utmUrl: utm("pinterest", normalizeUtmToken(theme)),
      recommendedRatio: "2:3",
      mediaKind: asset.mediaKind,
      sourceFileId: asset.fileId,
    },
  ];

  return { ok: true, packages };
}
