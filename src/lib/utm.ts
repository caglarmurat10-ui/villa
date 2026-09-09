// Tek, tutarlı UTM üretim/normalizasyon kaynağı (bölüm 7) - sosyal paylaşım linkleri, çok-platform
// içerik paketleri (platform-repurposing.ts) ve manuel yayın paketleri BURADAN üretir. Amaç: hangi
// paylaşımın hangi platformdan geldiğini D1 conversion_events'te (round 1) tutarlı biçimde
// görebilmek - "instagram" bir yerde "Instagram", başka yerde "ig" gibi tutarsız değerler asla.

export const SITE_ORIGIN = "https://safiradestan.com";

// Yalnız BU sabit liste kabul edilir - serbest metin kaynak asla üretilmez (attribution raporunda
// "instagram"/"Instagram"/"ig" gibi varyantların birikip veriyi parçalaması engellenir).
export const UTM_SOURCES = ["instagram", "facebook", "youtube", "tiktok", "pinterest", "google", "bing", "whatsapp", "direct"] as const;
export type UtmSource = (typeof UTM_SOURCES)[number];

export const UTM_MEDIUMS = ["organic_social", "organic_video", "organic_search", "organic_maps", "referral"] as const;
export type UtmMedium = (typeof UTM_MEDIUMS)[number];

// Platform -> varsayılan (source, medium) eşlemesi - bölüm 7'deki örneklerle birebir aynı.
export const PLATFORM_UTM_DEFAULTS: Record<string, { source: UtmSource; medium: UtmMedium }> = {
  instagram: { source: "instagram", medium: "organic_social" },
  facebook: { source: "facebook", medium: "organic_social" },
  youtube_shorts: { source: "youtube", medium: "organic_video" },
  tiktok: { source: "tiktok", medium: "organic_social" },
  pinterest: { source: "pinterest", medium: "organic_social" },
};

// utm_campaign/utm_content serbest metin olabilir ama D1'de/raporlarda tutarlı kalması için
// normalize edilir: küçük harfe çevrilir, Türkçe karakterler ASCII'ye indirgenir, yalnız
// [a-z0-9_] kalır (boşluk/tire -> alt çizgi), ardışık alt çizgiler tekilleştirilir.
const TURKISH_CHAR_MAP: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
  Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u",
};

export function normalizeUtmToken(value: string): string {
  const replaced = value.replace(/[çğışöüÇĞİŞÖÜ]/g, (ch) => TURKISH_CHAR_MAP[ch] ?? ch);
  return replaced
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

export function isValidUtmToken(value: string): boolean {
  return /^[a-z0-9_]{1,60}$/.test(value);
}

export interface BuildUtmUrlInput {
  path: string; // "/villa-destan" gibi, "/" ile başlamalı
  source: UtmSource;
  medium: UtmMedium;
  campaign: string; // normalize edilir
  content?: string; // normalize edilir, opsiyonel (bkz. "reel_001" örneği)
}

// Kaynak/medium sabit listeden gelir (tip zaten garanti eder) - yalnız campaign/content
// normalize/doğrulanır. Sonuç HER ZAMAN geçerli bir mutlak safiradestan.com URL'sidir.
export function buildUtmUrl(input: BuildUtmUrlInput): string {
  const url = new URL(input.path.startsWith("/") ? input.path : `/${input.path}`, SITE_ORIGIN);
  url.searchParams.set("utm_source", input.source);
  url.searchParams.set("utm_medium", input.medium);
  url.searchParams.set("utm_campaign", normalizeUtmToken(input.campaign));
  if (input.content) url.searchParams.set("utm_content", normalizeUtmToken(input.content));
  return url.toString();
}

// Bir platform id'sinden (organic-platforms.ts / platform-repurposing.ts ile aynı sözlük) doğrudan
// varsayılan source/medium ile UTM URL üretir - çağıran taraf her seferinde source/medium
// eşlemesini elle tekrarlamak zorunda kalmaz.
export function buildUtmUrlForPlatform(platform: keyof typeof PLATFORM_UTM_DEFAULTS, path: string, campaign: string, content?: string): string {
  const defaults = PLATFORM_UTM_DEFAULTS[platform];
  return buildUtmUrl({ path, source: defaults.source, medium: defaults.medium, campaign, content });
}
