import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getVillaLocations } from "./db";
import { WHATSAPP_PHONE_DISPLAY_INTL } from "./contact";
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
  searchConsoleState: GoogleReadinessState;
  ga4State: GoogleReadinessState;
  reviewLinksState: GoogleReadinessState;
  reviewAutomationState: GoogleReadinessState;
  napPhone: string;
}

// sitemap.ts'teki 10 URL'nin statik aynası - sitemap.ts kendisi de statik/elle yazılmış bir liste
// olduğu için (bkz. SEO audit bulgusu) burada da aynı gerçeği yansıtıyoruz, ayrı bir "gerçek" icat
// etmiyoruz.
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
  // Kullanıcı mevcut Safira/Destan GBP profillerinin sahibi olduğunu doğruladı (2026-09-01) - bu
  // yüzden artık WAITING_OWNER_ACCESS değil, spesifik olarak WAITING_API_ACCESS: hiçbir GBP
  // OAuth/service-account credential'ı Cloudflare secret'larında yok (doğrulandı, wrangler secret
  // list ile), bu yüzden kod hiçbir mutation/read API çağrısı yapamaz. GOOGLE_READY'ye geçiş yalnız
  // gerçek bir GBP API erişimi (OAuth client + onay) sağlandığında mümkün.
  const gbpState: GoogleReadinessState = "WAITING_API_ACCESS";
  const reviewAutomationState: GoogleReadinessState = placesApiConfigured && placeIdConfigured.Safira && placeIdConfigured.Destan
    ? "WAITING_OWNER_ACCESS" // API key+place ID olsa bile "yorum iste" linki olmadan otomasyon tam değildir
    : "WAITING_API_ACCESS";

  // Search Console/GA4: aynı Google OAuth client'ı (GOOGLE_CLIENT_ID/SECRET) gerektirir - hiçbiri
  // Cloudflare secret'larında yok (doğrulandı), bu yüzden ikisi de API erişimi bekliyor. OAuth
  // akışı hazır (src/app/api/admin/google/oauth/{start,callback}) ama client credential'ı
  // olmadan hiç tetiklenemez. GOOGLE_PRIVATE KV'de gerçek bir "connection:search_console" veya
  // "connection:ga4" kaydı varsa (kullanıcı OAuth akışını gerçekten tamamladıysa) GOOGLE_READY.
  const oauthClientConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const searchConsoleConnected = oauthClientConfigured && env.GOOGLE_PRIVATE
    ? Boolean(await env.GOOGLE_PRIVATE.get("connection:search_console"))
    : false;
  const ga4Connected = oauthClientConfigured && env.GOOGLE_PRIVATE
    ? Boolean(await env.GOOGLE_PRIVATE.get("connection:ga4"))
    : false;
  const searchConsoleState: GoogleReadinessState = searchConsoleConnected ? "GOOGLE_READY" : "WAITING_API_ACCESS";
  const ga4State: GoogleReadinessState = ga4Connected ? "GOOGLE_READY" : "WAITING_API_ACCESS";
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
    gbpState,
    searchConsoleState,
    ga4State,
    reviewLinksState,
    reviewAutomationState,
    napPhone: WHATSAPP_PHONE_DISPLAY_INTL,
  };
}
