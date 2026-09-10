"use client";

import type { VillaId } from "./analytics";
import { readStoredConsent } from "./analytics";

// Hafif Cloudflare-first (D1) attribution katmanı - GTM/GA4'ün YERİNE değil, ONUNLA BİRLİKTE.
// Amaç: hangi sosyal medya UTM linkinin WhatsApp/rezervasyon/iletişim dönüşümüne yol açtığını,
// işletme sahibinin admin panelinde basitçe görebilmesi (bkz. /api/admin/conversion-events/summary).
const ATTRIBUTION_STORAGE_KEY = "attribution-v1";
const TRACK_ENDPOINT = "/api/public/track";

type StoredAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
};

// "Session içinde ilk temas" modeli: UTM parametreleri yalnız İLK kez okunduğunda (bu sekme/oturum
// için) sessionStorage'a yazılır - kullanıcı siteyi gezerken UTM'siz bir sayfaya geçtiğinde önceki
// kaynağı KAYBETMEZ (asıl "hangi paylaşım getirdi" bilgisi budur, son tıklanan link değil).
export function captureAttributionFromUrl(): StoredAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl: StoredAttribution = {
      utmSource: params.get("utm_source") || undefined,
      utmMedium: params.get("utm_medium") || undefined,
      utmCampaign: params.get("utm_campaign") || undefined,
      utmContent: params.get("utm_content") || undefined,
    };
    const hasUtm = Boolean(fromUrl.utmSource || fromUrl.utmMedium || fromUrl.utmCampaign || fromUrl.utmContent);

    if (hasUtm) {
      window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }

    const stored = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as StoredAttribution;
  } catch {
    return null;
  }
}

function readStoredAttribution(): StoredAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as StoredAttribution) : null;
  } catch {
    return null;
  }
}

const VILLA_ID_TO_NAME: Record<VillaId, "Safira" | "Destan"> = { safira: "Safira", destan: "Destan" };

export type TrackableConversionEvent = "page_view" | "whatsapp_click" | "booking_click" | "contact_submit" | "instagram_click" | "facebook_click";

// fetch(keepalive:true) - sayfadan ayrılan bir tıklama (WhatsApp/Instagram dış link) sırasında bile
// isteğin tamamlanmasına izin verir; sendBeacon'dan farklı olarak JSON body/method esnekliği sağlar.
// Best-effort: başarısızlık kullanıcı deneyimini ASLA engellemez (navigasyonu geciktirmez/bloklamaz).
export function beaconConversionEvent(eventName: TrackableConversionEvent, villaId?: VillaId): void {
  if (typeof window === "undefined") return;
  // GTM/GA4 consent kapısıyla AYNI karar: kullanıcı analytics'e izin vermediyse (veya henüz karar
  // vermediyse - banner ilk yüklemede kapalı başlar) bu ilk-taraf D1 attribution çağrısı da
  // ATILMAZ. UTM/landing path düşük-PII olsa da IP ile eşleşen davranışsal veri sayılabileceği için
  // aynı onay durumuna tabi tutulur - analytics.ts'teki applyConsentDecision ile aynı kaynak.
  const consent = readStoredConsent();
  if (!consent?.analytics) return;
  try {
    const attribution = readStoredAttribution();
    const payload = {
      eventName,
      villa: villaId ? VILLA_ID_TO_NAME[villaId] : undefined,
      utmSource: attribution?.utmSource,
      utmMedium: attribution?.utmMedium,
      utmCampaign: attribution?.utmCampaign,
      utmContent: attribution?.utmContent,
      landingPath: window.location.pathname,
    };
    void fetch(TRACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // sessionStorage/fetch kullanılamıyor olabilir (gizli mod, eklenti engeli) - sessizce vazgeç.
  }
}
