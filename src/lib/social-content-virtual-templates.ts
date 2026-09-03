import { GUIDE_PLACES, GUIDE_CATEGORIES, type GuidePlace } from "@/lib/region-guide";
import { EVERGREEN_TIPS, TRUST_CLAIMS } from "@/lib/social-design-templates";
import { ITINERARY_DEFINITIONS, itineraryCaption, resolveItineraryPlaces } from "@/lib/itinerary-content";
import type { SocialContentTemplate } from "@/lib/social-content-library";
import type { Villa } from "@/lib/types";

// FAZ 5 bölüm 9/10 - Social Design Engine (ImageResponse) ile Content Planner arasındaki köprü.
// Statik 60 şablonluk kütüphane (social-content-library.ts) yalnız Villa/Bölge/Gezi/Müsaitlik/Özel
// theme'lerini kapsıyor - Tarih/Kültür/Doğa ve Yerel Yaşam/Gezi İpucu ("Diğer" kovası) için SIFIR
// gerçek şablon vardı (bkz. önceki tur raporu). Bu dosya region-guide.ts'in doğrulanmış, evergreen
// verisinden GERÇEK, benzersiz içerikli "sanal şablonlar" üretir - her biri /api/public/social-assets
// üzerinden gerçek zamanlı render edilen kendi görseline sahiptir (aynı metni yeni renkle tekrarlayan
// bir "duplicate guard'ı kandırma" değil - her yer/villa kombinasyonu gerçekten benzersiz metin+id).
//
// Hiçbir fiyat/saat/ücret/hava/tarih UYDURULMAZ - yalnız GUIDE_PLACES'teki (2026-09-01 çok kaynaklı
// doğrulanmış) sabit açıklamalar ve EVERGREEN_TIPS (social-design-templates.tsx, zaman/fiyattan
// bağımsız) kullanılır.

const VILLAS: Villa[] = ["Safira", "Destan"];

function villaSlug(villa: Villa): "safira" | "destan" {
  return villa === "Safira" ? "safira" : "destan";
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

// Faz 6 - "Doğrudan Rezervasyon/Güven" kovası (bkz. social-content-mix.ts) için GERÇEK, zaten
// canlı sitede yayınlanan doğrulanmış iddialar. TRUST_CLAIMS TEK KAYNAK social-design-templates.tsx'te
// tanımlı (renderTrustClaim ile AYNI dizi/index) - burada ayrı bir kopya YOK, görsel ve caption
// birbirinden asla sapamaz.
function trustCaption(claim: string, villa: Villa): { hook: string; caption: string } {
  return {
    hook: "Neden doğrudan bizden rezervasyon yapmalısınız?",
    caption: [claim, `Villa ${villa} · Patara`, `#${villaSlug(villa)}patara #patara #kaş #dogrudanrezervasyon #villatatili`].join("\n\n"),
  };
}

function baseTemplate(id: string, villa: Villa, theme: string, hook: string, caption: string, publicPath: string): SocialContentTemplate {
  const mediaUrl = `/api/public/social-assets/${publicPath}`;
  return {
    id, scheduledDate: new Date().toISOString().slice(0, 10), villa, format: "Feed", contentType: "Gönderi",
    theme, mediaFile: publicPath, hook, caption,
    mediaResolved: true, mediaKind: "image", driveFileId: "", driveViewUrl: "", previewUrl: "",
    mediaUrl, mediaUrls: [mediaUrl],
  };
}

// theme değerleri BİLİNÇLİ: her biri social-content-mix.ts'in THEME_TO_CATEGORY eşlemesinde
// birebir bir karşılığa sahip (Bölge/Gezi/Tarih-Doğa/Yerel İpucu/Güven) - hiçbiri artık bir
// "yedek" kovaya düşmüyor. region-guide.ts'in kendi "tarih"/"doga" kategorileri (GERÇEK, 2026-09-01
// çok kaynaklı doğrulanmış veri) "Tarih-Doğa" temasına, "deniz" ve diğerleri "Bölge"ye, "gezi" ise
// "Gezi"ye eşlenir - yeni bir ayrım UYDURULMADI, yalnız region-guide.ts'in zaten var olan
// kategorileri kullanıldı.
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
    for (const villa of VILLAS) {
      const { hook, caption } = guideCaption(place, villa);
      const publicPath = `${villaSlug(villa)}_${kickerType}_${place.id}/feed`;
      templates.push(baseTemplate(`guide-${villaSlug(villa)}-${place.id}`, villa, theme, hook, caption, publicPath));
    }
  }

  EVERGREEN_TIPS.forEach((tip, index) => {
    for (const villa of VILLAS) {
      const { hook, caption } = tipCaption(tip, villa);
      const publicPath = `${villaSlug(villa)}_travel-tip_${index}/feed`;
      templates.push(baseTemplate(`tip-${villaSlug(villa)}-${index}`, villa, "Yerel İpucu", hook, caption, publicPath));
    }
  });

  TRUST_CLAIMS.forEach((claim, index) => {
    for (const villa of VILLAS) {
      const { hook, caption } = trustCaption(claim, villa);
      const publicPath = `${villaSlug(villa)}_trust_${index}/feed`;
      templates.push(baseTemplate(`trust-${villaSlug(villa)}-${index}`, villa, "Güven", hook, caption, publicPath));
    }
  });

  // Faz 6.1 bölüm 11 - itinerary (rota) içerikleri. resolveItineraryPlaces null dönerse (eksik/
  // yanlış yazılmış bir GUIDE_PLACES id'si) o tanım HİÇ üretilmez - "bütün constituent bilgiler
  // evergreen/verified ise AUTO_SAFE" kuralı burada, üretim ANINDA zorlanır.
  for (const definition of ITINERARY_DEFINITIONS) {
    const places = resolveItineraryPlaces(definition);
    if (!places) continue;
    for (const villa of VILLAS) {
      const { hook, caption } = itineraryCaption(definition, places, villa);
      const publicPath = `${villaSlug(villa)}_itinerary_${definition.id}/feed`;
      templates.push(baseTemplate(`itinerary-${villaSlug(villa)}-${definition.id}`, villa, "Rota", hook, caption, publicPath));
    }
  }

  return templates;
}
