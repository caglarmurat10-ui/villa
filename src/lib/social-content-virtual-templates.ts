import { GUIDE_PLACES, GUIDE_CATEGORIES, type GuidePlace } from "@/lib/region-guide";
import { EVERGREEN_TIPS, TRUST_CLAIMS } from "@/lib/social-design-templates";
import { ITINERARY_DEFINITIONS, itineraryCaption, resolveItineraryPlaces } from "@/lib/itinerary-content";
import { ctaStyleForTheme, pickCtaLine } from "@/lib/social-engagement";
import { socialDriveMedia, type DriveMediaAsset } from "@/lib/social-drive-media";
import { VILLAS as VILLA_CONTENT, type VillaSlug } from "@/lib/villa-content";
import type { SocialContentTemplate } from "@/lib/social-content-library";
import type { Villa } from "@/lib/types";

// FAZ 5 bölüm 9/10 - Social Design Engine (ImageResponse) ile Content Planner arasındaki köprü.
// Statik 60 şablonluk kütüphane (social-content-library.ts) yalnız Villa/Bölge/Gezi/Müsaitlik/Özel
// theme'lerini kapsıyor - Tarih/Kültür/Doğa ve Yerel Yaşam/Gezi İpucu için sanal şablonlar burada
// doğrulanmış evergreen kaynaklardan üretilir.
//
// 2026-09-04 organik büyüme genişletmesi: sanal kütüphaneye ayrıca GERÇEK villa fotoğraflarından
// oluşan kaydetmelik carousel serileri eklendi. Bölge kartlarında villa fotoğrafı kullanılmaz;
// carousel'ler yalnız villa içeriği oldukları için Drive'daki ilgili villanın gerçek görsellerini
// kullanır. Destan Instagram publish guard'ına bu dosya dokunmaz.

const VILLA_NAMES: Villa[] = ["Safira", "Destan"];
const DISCOVERY_THEMES = new Set(["Bölge", "Gezi", "Tarih-Doğa", "Yerel İpucu", "Rota"]);
const VILLA_CAROUSEL_COUNT = 4;

function villaSlug(villa: Villa): "safira" | "destan" {
  return villa === "Safira" ? "safira" : "destan";
}

function villaContentSlug(villa: Villa): VillaSlug {
  return villa === "Safira" ? "villa-safira" : "villa-destan";
}

function stableSeed(value: string): number {
  let hash = 0;
  for (const char of value) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return hash;
}

function appendDiscoveryGrowthCta(id: string, theme: string, caption: string): string {
  if (!DISCOVERY_THEMES.has(theme)) return caption;
  const seed = stableSeed(id);
  const style = ctaStyleForTheme(theme, seed);
  return `${caption}\n\n${pickCtaLine(style, seed)}`;
}

function guideCaption(place: GuidePlace, villa: Villa): { hook: string; caption: string } {
  const categoryLabel = GUIDE_CATEGORIES.find((c) => c.slug === place.category)?.label ?? "";
  const hook = `${place.name} - Patara ve Kaş çevresinde keşfedilecek bir yer.`;
  const caption = [
    `${place.name}\n\n${place.description}`,
    `Villa ${villa} konumundan bölgeyi keşfetmek isteyenler için ${categoryLabel.toLowerCase()} kategorisinde gerçek bir öneri.`,
    `#${villaSlug(villa)}patara #patara #kaş #antalya #likya #gezirehberi`,
  ].join("\n\n");
  return { hook, caption };
}

function tipCaption(tip: string, villa: Villa): { hook: string; caption: string } {
  return {
    hook: "Bölgeyi keşfederken işinize yarayabilecek bir ipucu.",
    caption: [tip, `Villa ${villa} · Patara`, `#${villaSlug(villa)}patara #patara #kaş #antalya #geziipucu`].join("\n\n"),
  };
}

function trustCaption(claim: string, villa: Villa): { hook: string; caption: string } {
  return {
    hook: "Neden doğrudan bizden rezervasyon yapmalısınız?",
    caption: [claim, `Villa ${villa} · Patara`, `#${villaSlug(villa)}patara #patara #kaş #dogrudanrezervasyon #villatatili`].join("\n\n"),
  };
}

function baseTemplate(id: string, villa: Villa, theme: string, hook: string, caption: string, publicPath: string): SocialContentTemplate {
  const mediaUrl = `/api/public/social-assets/${publicPath}`;
  const finalCaption = appendDiscoveryGrowthCta(id, theme, caption);
  return {
    id, scheduledDate: new Date().toISOString().slice(0, 10), villa, format: "Feed", contentType: "Gönderi",
    theme, mediaFile: publicPath, hook, caption: finalCaption,
    mediaResolved: true, mediaKind: "image", driveFileId: "", driveViewUrl: "", previewUrl: "",
    mediaUrl, mediaUrls: [mediaUrl],
  };
}

// Dört carousel'in her biri aynı villanın fotoğraf havuzunda farklı bir başlangıç noktasına sahip
// olur. Başlangıçlar havuza eşitçe yayılır; böylece hash çakışması yüzünden aynı 4 fotoğraf seti
// farklı caption'larla tekrar kullanılamaz. Seçim yine deterministiktir ve yalnız yönetilen gerçek
// Drive görsellerini kullanır.
function imageCarouselAssets(villa: Villa, carouselIndex: number, count = 4): DriveMediaAsset[] {
  const pool = socialDriveMedia.filter((asset) => asset.villa === villa && asset.mediaKind === "image");
  if (pool.length < 2) return [];
  const spacing = Math.max(1, Math.floor(pool.length / VILLA_CAROUSEL_COUNT));
  const base = stableSeed(villa) % pool.length;
  const start = (base + carouselIndex * spacing) % pool.length;
  const result: DriveMediaAsset[] = [];
  for (let offset = 0; offset < pool.length && result.length < count; offset += 1) {
    const asset = pool[(start + offset) % pool.length];
    if (!result.some((item) => item.fileId === asset.fileId)) result.push(asset);
  }
  return result;
}

function baseVillaCarousel(
  id: string,
  villa: Villa,
  carouselIndex: number,
  hook: string,
  caption: string,
  ctaStyle: "soru" | "kaydet" | "paylas" | "profil-incele",
): SocialContentTemplate | null {
  const assets = imageCarouselAssets(villa, carouselIndex, 4);
  if (assets.length < 2) return null;
  const seed = stableSeed(id);
  const mediaUrls = assets.map((asset) => asset.proxyPath);
  const first = assets[0];
  return {
    id,
    scheduledDate: new Date().toISOString().slice(0, 10),
    villa,
    format: "Carousel",
    contentType: "Gönderi",
    theme: "Villa",
    // Duplicate guard açısından tek fotoğraf değil, carousel kompozisyonunun kendisi medyadır.
    mediaFile: `carousel:${assets.map((asset) => asset.fileId).join(",")}`,
    hook,
    caption: `${caption}\n\n${pickCtaLine(ctaStyle, seed)}`,
    mediaResolved: true,
    mediaKind: "image",
    driveFileId: first.fileId,
    driveViewUrl: first.viewUrl,
    previewUrl: first.previewUrl,
    mediaUrl: first.proxyPath,
    mediaUrls,
  };
}

function villaCarouselTemplates(villa: Villa): SocialContentTemplate[] {
  const content = VILLA_CONTENT[villaContentSlug(villa)];
  const brandHashtag = villa === "Safira" ? "#villasafirapatara" : "#villadestanpatara";
  const highlightNames = content.highlights.slice(0, 4).map((item) => item.title).join(" · ");
  const definitions: Array<{
    key: string;
    hook: string;
    caption: string;
    cta: "soru" | "kaydet" | "paylas" | "profil-incele";
  }> = [
    {
      key: "hizli-ozet",
      hook: `${content.name}'yı 4 gerçek karede tanıyın.`,
      caption: [
        `${content.name} hızlı özet`,
        content.quickFacts.summary,
        "Carousel'deki görseller villanın kendi gerçek fotoğraflarından seçildi.",
        `${brandHashtag} #patara #kaş #villatatili #özelhavuz`,
      ].join("\n\n"),
      cta: "kaydet",
    },
    {
      key: "detaylar",
      hook: "Villa seçerken ilk baktığınız detay hangisi?",
      caption: [
        `${content.name}'da öne çıkan bazı detaylar: ${highlightNames}.`,
        "Fotoğrafları kaydırın ve sizin için en önemli detayı yorumlara yazın.",
        `${brandHashtag} #patara #kaş #villatatili #tatilplanı`,
      ].join("\n\n"),
      cta: "soru",
    },
    {
      key: "grup-plani",
      hook: "Tatil planınız kaç kişilik?",
      caption: [
        `${content.name}, maksimum ${content.quickFacts.maxGuests} misafir ve ${content.quickFacts.bedroomCount} yatak odasıyla planlanmıştır.`,
        content.quickFacts.summary,
        "Birlikte tatil planladığınız kişiye bu carousel'i gönderin.",
        `${brandHashtag} #patara #kaş #villatatili #akdeniztatili`,
      ].join("\n\n"),
      cta: "paylas",
    },
    {
      key: "gercek-kareler",
      hook: "Villayı seçmeden önce gerçek karelere bakın.",
      caption: [
        `${content.name}'dan dört gerçek fotoğrafı tek gönderide bir araya getirdik.`,
        "Amacımız aynı kareyi tekrar tekrar göstermek değil; villanın farklı alanlarını daha kolay karşılaştırabilmeniz.",
        `${brandHashtag} #patara #kaş #villatatili #gerçekfotoğraf`,
      ].join("\n\n"),
      cta: "profil-incele",
    },
  ];

  return definitions
    .map((definition, carouselIndex) => baseVillaCarousel(
      `villa-carousel-${villaSlug(villa)}-${definition.key}`,
      villa,
      carouselIndex,
      definition.hook,
      definition.caption,
      definition.cta,
    ))
    .filter((template): template is SocialContentTemplate => Boolean(template));
}

function guideTheme(category: GuidePlace["category"]): string {
  if (category === "gezi") return "Gezi";
  if (category === "tarih" || category === "doga") return "Tarih-Doğa";
  return "Bölge";
}

export function buildVirtualTemplates(): SocialContentTemplate[] {
  const templates: SocialContentTemplate[] = [];

  for (const place of GUIDE_PLACES) {
    const theme = guideTheme(place.category);
    const kickerType = place.category === "gezi" ? "activity" : "destination";
    for (const villa of VILLA_NAMES) {
      const { hook, caption } = guideCaption(place, villa);
      const publicPath = `${villaSlug(villa)}_${kickerType}_${place.id}/feed`;
      templates.push(baseTemplate(`guide-${villaSlug(villa)}-${place.id}`, villa, theme, hook, caption, publicPath));
    }
  }

  EVERGREEN_TIPS.forEach((tip, index) => {
    for (const villa of VILLA_NAMES) {
      const { hook, caption } = tipCaption(tip, villa);
      const publicPath = `${villaSlug(villa)}_travel-tip_${index}/feed`;
      templates.push(baseTemplate(`tip-${villaSlug(villa)}-${index}`, villa, "Yerel İpucu", hook, caption, publicPath));
    }
  });

  TRUST_CLAIMS.forEach((claim, index) => {
    for (const villa of VILLA_NAMES) {
      const { hook, caption } = trustCaption(claim, villa);
      const publicPath = `${villaSlug(villa)}_trust_${index}/feed`;
      templates.push(baseTemplate(`trust-${villaSlug(villa)}-${index}`, villa, "Güven", hook, caption, publicPath));
    }
  });

  for (const definition of ITINERARY_DEFINITIONS) {
    const places = resolveItineraryPlaces(definition);
    if (!places) continue;
    for (const villa of VILLA_NAMES) {
      const { hook, caption } = itineraryCaption(definition, places, villa);
      const publicPath = `${villaSlug(villa)}_itinerary_${definition.id}/feed`;
      templates.push(baseTemplate(`itinerary-${villaSlug(villa)}-${definition.id}`, villa, "Rota", hook, caption, publicPath));
    }
  }

  // Kaydetme/paylaşma potansiyeli yüksek, yalnız gerçek villa fotoğraflarından oluşan carousel'ler.
  for (const villa of VILLA_NAMES) templates.push(...villaCarouselTemplates(villa));

  return templates;
}
