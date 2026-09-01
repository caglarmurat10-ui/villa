// GTM/GA4 analytics katmanı — TEK yükleyici: GTM-KFZ62MJG. GA4 (G-0VYXCFEKND) doğrudan gtag.js ile
// gömülmez, yalnızca GTM container'ı içinden GA4 Configuration tag olarak çalışır (duplicate page_view
// riski olmasın diye). Bu dosya sadece PUBLIC SITE'ta mount edilir (bkz. layout.tsx isPublicSite) —
// admin.safiradestan.com ve workers.dev'de hiç çalışmaz.
//
// Google'ın resmi "Consent Mode + GTM-only" deseni kullanılıyor: gtag.js kütüphanesi hiç yüklenmiyor,
// yalnızca standart gtag() SHIM'i (dataLayer.push(arguments)) consent default/update komutları için
// kullanılıyor — GTM bu formatı gtag.js olmadan da tanır. Bu iki yardımcı KASITLI olarak farklı push
// biçimleri kullanır:
//   - pushArgs(): consent komutları ve gtm.start için "arguments dizisi" biçimi (gtag() ile aynı).
//   - pushEvent(): bizim business event'lerimiz için GTM'in standart "{event, ...params}" obje biçimi.
// Consent-default script'i (layout.tsx, beforeInteractive) bu dosyayı import EDEMEZ (modül yüklenmeden
// önce çalışması gerekiyor) — CONSENT_STORAGE_KEY orada elle senkron tutulur, burada değiştirirsen orada
// da değiştir.

export const GTM_ID = "GTM-KFZ62MJG";

export const CONSENT_STORAGE_KEY = "cookie-consent-v1";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export interface StoredConsent {
  analytics: boolean;
  ts: string;
}

function pushArgs(...args: unknown[]) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

function pushEvent(event: string, params: Record<string, string | number | boolean | undefined> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) clean[key] = value;
  }
  window.dataLayer.push({ event, ...clean });
}

export function readStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    return typeof parsed.analytics === "boolean" ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredConsent(analytics: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const value: StoredConsent = { analytics, ts: new Date().toISOString() };
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // localStorage kullanılamıyor olabilir (gizli mod vb.) - consent bu oturum için yine de uygulanır,
    // sadece bir sonraki ziyarette tekrar sorulur.
  }
}

// Banner/Tercihler panelindeki aksiyonlardan çağrılır. GTM zaten yüklü (advanced consent mode - tag'ler
// engellenmiyor, yalnızca consent sinyaline göre davranıyor); bu yalnızca sinyali günceller. Pazarlama
// alanları (ad_*) şu an aktif kullanılmadığı için kasıtlı olarak hep "denied" kalır.
export function applyConsentDecision(analyticsGranted: boolean): void {
  writeStoredConsent(analyticsGranted);
  pushArgs("consent", "update", {
    analytics_storage: analyticsGranted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

const OPEN_PREFERENCES_EVENT = "open-cookie-preferences";

export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
}

export function onOpenCookiePreferences(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(OPEN_PREFERENCES_EVENT, handler);
  return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, handler);
}

export type VillaId = "safira" | "destan";

export function toVillaId(villa: "Safira" | "Destan"): VillaId {
  return villa === "Safira" ? "safira" : "destan";
}

interface VillaRef {
  villa_id: VillaId;
  villa_name: string;
}

// PRIMARY key event. Yalnız backend POST gerçekten başarılı döndüğünde çağrılmalı - form submit
// butonuna basıldığında DEĞİL.
export function trackGenerateLead(ref: VillaRef, ctaLocation?: string) {
  pushEvent("generate_lead", { ...ref, cta_location: ctaLocation });
}

// GA4 Enhanced Ecommerce şeması: items GA4'ün beklediği nested "ecommerce.items" biçiminde gönderilir.
// Önceki ecommerce objesini temizlemek (ecommerce:null push'u) GA4/GTM'in resmi ecommerce event
// tavsiyesidir - art arda view_item event'lerinde eski items dizisinin sızmasını önler.
export function trackViewItem(ref: VillaRef) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event: "view_item",
    ecommerce: {
      items: [{ item_id: ref.villa_id, item_name: ref.villa_name, item_category: "villa" }],
    },
  });
}

// Takvimde anlamlı bir tarih aralığı (giriş+çıkış) seçildiğinde - her tıklama/keystroke'ta değil.
export function trackCheckAvailability(ref: VillaRef) {
  pushEvent("check_availability", { ...ref });
}

export function trackWhatsappClick(params: { villa_id?: VillaId; villa_name?: string; cta_location: string }) {
  pushEvent("whatsapp_click", { ...params, contact_method: "whatsapp" });
}

export function trackPhoneClick(params: { villa_id?: VillaId; cta_location: string }) {
  pushEvent("phone_click", { ...params, contact_method: "phone" });
}

export function trackMapsClick(params: Partial<VillaRef> & { cta_location: string; map_action: "open_maps" | "directions" }) {
  pushEvent("maps_click", { ...params });
}

// Yalnızca lightbox'ın anlamlı açılışı (bir küçük resme tıklanması) için çağrılmalı - prev/next
// swipe/ok tuşu gezinmesi için event spam üretilmemeli.
export function trackGalleryInteraction(params: { villa_id: VillaId; gallery_category?: string }) {
  pushEvent("gallery_interaction", { ...params });
}

export function trackGuidePlaceClick(params: { place_id: string; place_name: string; place_category: string }) {
  pushEvent("guide_place_click", { ...params, action: "open_maps" });
}
