import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getVillaLocations } from "./db";
import { WHATSAPP_PHONE_DISPLAY_INTL } from "./contact";
import { getSearchConsoleProbe, type SearchConsoleSummary } from "./google-search-console";
import { getGa4Probe, type Ga4Summary } from "./google-analytics";
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
  oauthClientConfigured: boolean;
  gbpState: GoogleReadinessState;
  searchConsoleState: GoogleReadinessState;
  searchConsole: SearchConsoleSummary | null;
  searchConsoleError: string | null;
  ga4State: GoogleReadinessState;
  ga4: Ga4Summary | null;
  ga4Error: string | null;
  reviewLinksState: GoogleReadinessState;
  reviewAutomationState: GoogleReadinessState;
  napPhone: string;
}

const SITEMAP_URLS = [
  "https://safiradestan.com/",
  "https://safiradestan.com/villa-safira",
  "https://safiradestan.com/villa-destan",
  "https://safiradestan.com/rezervasyon-kosullari",
  "https://safiradestan.com/rehber",
  "https://safiradestan.com/rehber/patara",
  "https://safiradestan.com/rehber/patara-plaji",
  "https://safiradestan.com/rehber/patara-antik-kenti",
  "https://safiradestan.com/rehber/kas",
  "https://safiradestan.com/rehber/kalkan",
];

const JSON_LD_PAGES = [
  "/ (WebSite, Organization, FAQPage)",
  "/villa-safira (VacationRental+telephone, BreadcrumbList, FAQPage)",
  "/villa-destan (VacationRental+telephone, BreadcrumbList, FAQPage)",
  "/rehber/* (5 sayfa — BreadcrumbList, WebPage, FAQPage)",
];

export async function getGoogleVisibilitySnapshot(): Promise<GoogleVisibilitySnapshot> {
  const { env } = await getCloudflareContext({ async: true });
  const oauthClientConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const [locations, searchConsoleProbe, ga4Probe] = await Promise.all([
    getVillaLocations(),
    getSearchConsoleProbe(),
    getGa4Probe(),
  ]);

  const placesApiConfigured = Boolean(env.GOOGLE_PLACES_API_KEY);
  const placeIdConfigured: Record<Villa, boolean> = {
    Safira: Boolean(env.GOOGLE_PLACE_ID_SAFIRA),
    Destan: Boolean(env.GOOGLE_PLACE_ID_DESTAN),
  };
  const reviewRequestUrlConfigured: Record<Villa, boolean> = {
    Safira: Boolean(env.GOOGLE_REVIEW_REQUEST_URL_SAFIRA),
    Destan: Boolean(env.GOOGLE_REVIEW_REQUEST_URL_DESTAN),
  };

  // GBP hazır sayılmaz: OAuth tokenının varlığı tek başına yeterli değildir. Google Cloud proje
  // erişim onayı ve gerçek Business Profile API probe'u daha sonra ayrıca doğrulanacaktır.
  const gbpState: GoogleReadinessState = "WAITING_API_ACCESS";
  const reviewAutomationState: GoogleReadinessState = placesApiConfigured && placeIdConfigured.Safira && placeIdConfigured.Destan
    ? "WAITING_OWNER_ACCESS"
    : "WAITING_API_ACCESS";

  // Search Console ve GA4 GOOGLE_READY yalnız canlı API probe başarılıysa olur. Böylece KV'de
  // refresh token var ama ilgili API kapalı/property-stream yetkisi yok gibi durumlar yanlışlıkla
  // "Bağlı" görünmez.
  const searchConsoleState: GoogleReadinessState = searchConsoleProbe.ready ? "GOOGLE_READY" : "WAITING_API_ACCESS";
  const ga4State: GoogleReadinessState = ga4Probe.ready ? "GOOGLE_READY" : "WAITING_API_ACCESS";
  const reviewLinksState: GoogleReadinessState = reviewRequestUrlConfigured.Safira && reviewRequestUrlConfigured.Destan
    ? "GOOGLE_READY"
    : "WAITING_API_ACCESS";

  return {
    sitemapUrls: SITEMAP_URLS,
    jsonLdPages: JSON_LD_PAGES,
    mapsLinkConfigured: { Safira: Boolean(locations.Safira), Destan: Boolean(locations.Destan) },
    placesApiConfigured,
    placeIdConfigured,
    reviewRequestUrlConfigured,
    oauthClientConfigured,
    gbpState,
    searchConsoleState,
    searchConsole: searchConsoleProbe.data,
    searchConsoleError: searchConsoleProbe.error,
    ga4State,
    ga4: ga4Probe.data,
    ga4Error: ga4Probe.error,
    reviewLinksState,
    reviewAutomationState,
    napPhone: WHATSAPP_PHONE_DISPLAY_INTL,
  };
}
