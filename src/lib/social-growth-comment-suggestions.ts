import type { ProspectCategory } from "./social-growth-store";

// Üçüncü taraf içeriklere hiçbir zaman otomatik gönderim YAPILMAZ - bu modül yalnız bir METİN
// ÖNERİSİ üretir, kullanıcı isterse Instagram'da elle paylaşır. Bu yüzden riskClassification
// HER ZAMAN sabit "REVIEW_REQUIRED" döner (bkz. çağıran route, opportunity kaydına bu değerle yazar).
//
// Kurallar (şablonların KENDİSİ bu kısıtları garanti eder, çalışma zamanında filtrelenmez):
// - kısa, doğal, içeriğe uygun
// - link YOK, fiyat YOK, rezervasyon çağrısı YOK, agresif satış dili YOK
// - villa adı/marka adı hiçbir şablonda geçmez (organik görünmesi için)

type TemplateBucket = "nature" | "food" | "photo" | "family" | "generic";

const CATEGORY_BUCKET: Record<ProspectCategory, TemplateBucket> = {
  travel_creator: "nature",
  local_creator: "nature",
  tourism_page: "nature",
  high_value_guest_source: "family",
  family_travel: "family",
  photographer: "photo",
  food_creator: "food",
  lifestyle_creator: "generic",
  local_business: "generic",
};

const TEMPLATES: Record<TemplateBucket, string[]> = {
  nature: [
    "{location} gerçekten başka güzel 🌿",
    "Bu kareyi görünce {location} özlemi geldi.",
    "{location}'ın bu hali insanı dinlendiriyor.",
  ],
  food: [
    "Bu lezzet gerçekten iştah açıcı görünüyor 🍽️",
    "{location} mutfağını bu kadar güzel göstermek için elinize sağlık.",
  ],
  photo: [
    "Kare gerçekten çok başarılı, ışık müthiş 📸",
    "{location}'ı bu açıdan görmek güzelmiş.",
  ],
  family: [
    "Aile tatili için gerçekten ilham verici bir paylaşım.",
    "{location} çocuklarla gezmek için harika görünüyor.",
  ],
  generic: [
    "{location} paylaşımların gerçekten keyifli.",
    "Güzel bir kare, {location}'ı böyle görmek güzel.",
  ],
};

const BANNED_PATTERNS = [/https?:\/\//i, /www\./i, /rezervasyon/i, /fiyat/i, /\d+\s?(tl|₺|usd|\$)/i, /hemen (ara|yaz|rezerve)/i];

export type CommentSuggestion = { suggestedComment: string; riskClassification: "REVIEW_REQUIRED" };

export function generateCommentSuggestion(input: {
  category: ProspectCategory;
  locationHint: string | null;
  seedIndex?: number;
}): CommentSuggestion {
  const bucket = CATEGORY_BUCKET[input.category] ?? "generic";
  const templates = TEMPLATES[bucket];
  const index = input.seedIndex !== undefined
    ? ((input.seedIndex % templates.length) + templates.length) % templates.length
    : Math.floor(Math.random() * templates.length);
  const location = input.locationHint?.trim() || "bölge";
  const suggestedComment = templates[index]!.replace(/\{location\}/g, location);

  if (BANNED_PATTERNS.some((pattern) => pattern.test(suggestedComment))) {
    // Şablonlar bu içeriği asla üretmemeli - üretirse güvenli bir varsayılana düş (savunma katmanı).
    return { suggestedComment: "Gerçekten güzel bir paylaşım olmuş.", riskClassification: "REVIEW_REQUIRED" };
  }
  return { suggestedComment, riskClassification: "REVIEW_REQUIRED" };
}
