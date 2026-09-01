import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getVillaLocations } from "./db";
import type { Villa } from "./types";

// Admin "Google Görünürlük" paneli için tek kaynak - hiçbir alan tahmin/uydurma değil, yalnız
// kodda gerçekten var olan/yapılandırılmış olan şeyleri raporlar. Search Console/GBP API bağlı
// değilken index sayısı veya review sayısı ASLA gösterilmez - yalnız durum etiketleri gösterilir.

export type GoogleReadinessState = "GOOGLE_READY" | "WAITING_OWNER_ACCESS" | "WAITING_API_ACCESS";

export interface GoogleVisibilitySnapshot {
  sitemapUrls: string[];
  jsonLdPages: string[];
  mapsLinkConfigured: Record<Villa, boolean>;
  placesApiConfigured: boolean;
  placeIdConfigured: Record<Villa, boolean>;
  reviewRequestUrlConfigured: Record<Villa, boolean>;
  gbpState: GoogleReadinessState;
  reviewAutomationState: GoogleReadinessState;
}

// sitemap.ts'teki 5 URL'nin statik aynası - sitemap.ts kendisi de statik/elle yazılmış bir liste
// olduğu için (bkz. SEO audit bulgusu) burada da aynı gerçeği yansıtıyoruz, ayrı bir "gerçek" icat
// etmiyoruz.
const SITEMAP_URLS = [
  "https://safiradestan.com/",
  "https://safiradestan.com/villa-safira",
  "https://safiradestan.com/villa-destan",
  "https://safiradestan.com/rezervasyon-kosullari",
  "https://safiradestan.com/rehber",
];

const JSON_LD_PAGES = [
  "/ (WebSite, Organization, FAQPage)",
  "/villa-safira (VacationRental, BreadcrumbList, FAQPage)",
  "/villa-destan (VacationRental, BreadcrumbList, FAQPage)",
];

export async function getGoogleVisibilitySnapshot(): Promise<GoogleVisibilitySnapshot> {
  const { env } = await getCloudflareContext({ async: true });
  const locations = await getVillaLocations();
  const placesApiConfigured = Boolean(env.GOOGLE_PLACES_API_KEY);
  const placeIdConfigured: Record<Villa, boolean> = {
    Safira: Boolean(env.GOOGLE_PLACE_ID_SAFIRA),
    Destan: Boolean(env.GOOGLE_PLACE_ID_DESTAN),
  };
  const reviewRequestUrlConfigured: Record<Villa, boolean> = {
    Safira: Boolean(env.GOOGLE_REVIEW_REQUEST_URL_SAFIRA),
    Destan: Boolean(env.GOOGLE_REVIEW_REQUEST_URL_DESTAN),
  };
  // GBP owner/manager erişimi koddan doğrulanamaz - bu her zaman en az WAITING_OWNER_ACCESS'tir,
  // yalnız kullanıcı bunu manuel doğrulayıp bize API erişimi (OAuth + GBP API approval) sağladığında
  // GOOGLE_READY'ye geçebilir (bu geçiş de kod değil, insan onayı gerektirir).
  const gbpState: GoogleReadinessState = "WAITING_OWNER_ACCESS";
  const reviewAutomationState: GoogleReadinessState = placesApiConfigured && placeIdConfigured.Safira && placeIdConfigured.Destan
    ? "WAITING_OWNER_ACCESS" // API key+place ID olsa bile "yorum iste" linki olmadan otomasyon tam değildir
    : "WAITING_API_ACCESS";

  return {
    sitemapUrls: SITEMAP_URLS,
    jsonLdPages: JSON_LD_PAGES,
    mapsLinkConfigured: { Safira: Boolean(locations.Safira), Destan: Boolean(locations.Destan) },
    placesApiConfigured,
    placeIdConfigured,
    reviewRequestUrlConfigured,
    gbpState,
    reviewAutomationState,
  };
}
