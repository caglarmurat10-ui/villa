import { ImageResponse } from "next/og";
import { GUIDE_PLACES, GUIDE_CATEGORIES } from "@/lib/region-guide";
import { socialDriveMedia } from "@/lib/social-drive-media";
import { getSpecialDayForDate } from "@/lib/special-days";
import type { Villa } from "@/lib/types";

// FAZ 5 bölüm 4/9/10 - Social Design Engine'in paylaşılan render katmanı. Hem admin-korumalı
// önizleme rotası (src/app/api/social-assets/[villa]/template/[type]/route.tsx) HEM public,
// kimliksiz, allowlisted medya rotası (src/app/api/public/social-assets/[id]/[format]/route.tsx)
// BU dosyayı kullanır - iki ayrı render mantığı YOK, tek kaynak.
//
// PROVENANCE GÜVENLİĞİ (değişmedi, bkz. önceki tur):
//  - Destination/Activity/Travel Tip: metin-odaklı, fotoğraf YOK - bölgede doğrulanmış yer
//    fotoğrafımız olmadığı için villa fotoğrafını bir yermiş gibi göstermek YASAK.
//  - Villa Lifestyle/Offer: YALNIZ gerçek, Drive'dan çözümlenmiş, lisanslı villa fotoğrafı.
//  - Destination/Activity içeriği YALNIZ GUIDE_PLACES'ten (region-guide.ts, doğrulanmış) gelir.

export type TemplateType = "destination" | "activity" | "villa-lifestyle" | "travel-tip" | "offer" | "trust" | "special-day" | "local-event";
export type Format = "feed" | "story";

export const TEMPLATE_TYPES: TemplateType[] = ["destination", "activity", "villa-lifestyle", "travel-tip", "offer", "trust", "special-day", "local-event"];

const DIMENSIONS: Record<Format, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

const BRAND: Record<Villa, { monogram: string; name: string }> = {
  Safira: { monogram: "VS", name: "VILLA SAFIRA" },
  Destan: { monogram: "VD", name: "VILLA DESTAN" },
};

const NAVY = "#061a33";
const GOLD = "#d8b36a";
const CREAM = "#f4e1b4";

export function isVilla(value: string): value is Villa {
  return value === "Safira" || value === "Destan";
}

export function isTemplateType(value: string): value is TemplateType {
  return (TEMPLATE_TYPES as string[]).includes(value);
}

export function isFormat(value: string): value is Format {
  return value === "feed" || value === "story";
}

// Travel Tip - sabit, doğrulanmamış/değişken bilgi İÇERMEYEN genel/evergreen öneriler (fiyat/saat/
// hava/tarihten bağımsız, bkz. social-content-planner.ts classifyContentSafety aynı ilke).
export const EVERGREEN_TIPS = [
  "Patara'nın uzun kumsalı deniz kaplumbağalarının koruma alanıdır - akşam saatlerinde kumsalda ışık kullanımına dikkat edilmesi istenir.",
  "Kaş ve Patara çevresinde araç kiralamak, bölgedeki antik kentleri kendi temponuzda gezmek için pratik bir seçenektir.",
  "Likya bölgesindeki antik kentleri gezerken rahat yürüyüş ayakkabısı ve şapka bulundurmanız öneriliriz.",
  "Villa Safira ve Villa Destan'dan çevredeki koylara ve antik kentlere kendi aracınızla ulaşmak mümkündür.",
];

// Faz 6 - "Doğrudan Rezervasyon/Güven" kovası için GERÇEK, zaten canlı sitede yayınlanan
// doğrulanmış iddialar (TrustStrip.tsx, ReservationConfidenceSection.tsx, PublicBookingWidget.tsx
// trust satırı) - yeni bir iddia UYDURULMAZ. Taksit gibi KOŞULLU doğru (installmentVerified'a
// bağlı) hiçbir iddia burada YOK - yalnız her zaman, koşulsuz doğru olan maddeler kullanılır.
export const TRUST_CLAIMS = [
  "Müsaitlik, yönetim sistemimizdeki gerçek rezervasyon takvimiyle karşılaştırılır - tahmini/güncel olmayan bir bilgi paylaşmayız.",
  "Gördüğünüz tutar, seçtiğiniz tarihler için sistemde tanımlı gerçek dönemsel fiyattır; ödeme sırasında ayrıca işletme komisyonu eklenmez.",
  "Rezervasyon talebiniz bir aracı üzerinden değil, doğrudan villa yönetimine ulaşır.",
  "Ön ödeme, iptal ve konaklama koşulları rezervasyon öncesinde nettir - sürpriz şart yoktur.",
];

function BrandFooter({ villa }: { villa: Villa }) {
  const brand = BRAND[villa];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ width: 56, height: 56, border: `2px solid ${GOLD}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: GOLD }}>{brand.monogram}</div>
      <div style={{ fontFamily: "sans-serif", fontSize: 20, letterSpacing: 4, color: CREAM }}>{brand.name}</div>
    </div>
  );
}

function textCard(villa: Villa, format: Format, kicker: string, title: string, body: string) {
  const { width, height } = DIMENSIONS[format];
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: NAVY, color: CREAM, padding: 76, fontFamily: "serif" }}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: format === "story" ? 60 : 20 }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 24, letterSpacing: 8, color: GOLD }}>{kicker}</div>
        <div style={{ width: 90, height: 3, background: GOLD, margin: "28px 0 34px" }} />
        <div style={{ fontSize: 66, lineHeight: 1.12, fontWeight: 500, color: CREAM }}>{title}</div>
        <div style={{ fontFamily: "sans-serif", fontSize: 27, lineHeight: 1.6, color: "#c9b98e", marginTop: 40, maxWidth: width - 152 }}>{body}</div>
      </div>
      <BrandFooter villa={villa} />
    </div>,
    { width, height },
  );
}

function photoCard(villa: Villa, format: Format, kicker: string, title: string, subtitle: string) {
  const { width, height } = DIMENSIONS[format];
  const asset = socialDriveMedia.find((item) => item.villa === villa && item.mediaKind === "image");
  const imageUrl = asset ? asset.previewUrl.replace("sz=w1600", `sz=w${Math.max(width, height) + 400}`) : "";

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: NAVY, fontFamily: "serif" }}>
      {imageUrl ? <img src={imageUrl} alt="" width={width} height={height} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
      <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(0deg, rgba(4,19,40,.96) 0%, rgba(4,19,40,.55) 38%, rgba(4,19,40,.08) 62%)" }} />
      <div style={{ position: "absolute", left: 64, right: 64, bottom: 70, display: "flex", flexDirection: "column", color: CREAM }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 22, letterSpacing: 7, color: GOLD, marginBottom: 20 }}>{kicker}</div>
        <div style={{ fontSize: 60, lineHeight: 1.08, fontWeight: 500 }}>{title}</div>
        <div style={{ fontFamily: "sans-serif", fontSize: 25, color: "#e9dcb8", marginTop: 18 }}>{subtitle}</div>
        <div style={{ marginTop: 34 }}><BrandFooter villa={villa} /></div>
      </div>
    </div>,
    { width, height },
  );
}

export function renderDestinationOrActivity(villa: Villa, format: Format, placeId: string, kicker: "BÖLGE REHBERİ" | "AKTİVİTE ÖNERİSİ"): Response | null {
  const place = GUIDE_PLACES.find((item) => item.id === placeId);
  if (!place) return null;
  const categoryLabel = GUIDE_CATEGORIES.find((c) => c.slug === place.category)?.label ?? place.category;
  return textCard(villa, format, `${kicker} · ${categoryLabel.toUpperCase()}`, place.name, place.description);
}

export function renderTravelTip(villa: Villa, format: Format, tipIndex: number): Response | null {
  if (tipIndex < 0 || tipIndex >= EVERGREEN_TIPS.length) return null;
  return textCard(villa, format, "GEZİ İPUCU", "Bölgeyi keşfederken", EVERGREEN_TIPS[tipIndex]);
}

export function renderVillaLifestyle(villa: Villa, format: Format): Response {
  const line = villa === "Safira" ? "Doğayla iç içe, sakin bir Patara tatili." : "Mahremiyet odaklı, akşamları güzelleşen bir kaçış.";
  return photoCard(villa, format, "VILLA YAŞAM", `${BRAND[villa].name.split(" ")[1] ?? villa} Patara`, line);
}

// Fiyat/taksit UYDURULMAZ - yalnız genel, her zaman doğru olan "doğrudan rezervasyon" mesajı.
// Gerçek fiyat/kampanya iddiaları yalnız canonical price-engine.ts kaynağından, doğrulanmış
// durumlarda ayrı bir aşamada eklenmelidir.
export function renderOfferCampaign(villa: Villa, format: Format): Response {
  return photoCard(villa, format, "DOĞRUDAN REZERVASYON", "Aracısız, doğrudan sizinle.", "Gerçek müsaitlik ve dönemsel fiyat, doğrudan rezervasyon.");
}

export function renderTrustClaim(villa: Villa, format: Format, claimIndex: number): Response | null {
  if (claimIndex < 0 || claimIndex >= TRUST_CLAIMS.length) return null;
  return textCard(villa, format, "GÜVEN", "Neden doğrudan bizden?", TRUST_CLAIMS[claimIndex]);
}

// SPECIAL DAY / HOLIDAY - bölüm 6 kuralı: ticari satış ilanı gibi görünmez, fiyat/müsaitlik CTA'sı
// yok, sade ve saygılı, marka logosu küçük (mevcut BrandFooter zaten küçük - yeni bir tasarım
// gerekmez), günün anlamı merkezde. key = tarih (YYYY-MM-DD) - getSpecialDayForDate ile eşleşen
// GERÇEK bir özel gün YOKSA (uydurma tarih/id kabul edilmez) null döner.
export function renderSpecialDay(villa: Villa, format: Format, dateIso: string): Response | null {
  const match = getSpecialDayForDate(dateIso);
  if (!match) return null;
  const name = match.kind === "fixed" ? match.holiday.name : match.entry.name;
  return textCard(villa, format, "ÖZEL GÜN", name, match.message);
}

// LOCAL EVENT - içerik D1'deki admin-onaylı aday kayıtlarına dayanır (bkz. local-events.ts), bu
// yüzden bu fonksiyon SAF kalır (D1 çağrısı YOK) - çağıran taraf (route handler) zaten doğrulanmış
// title/dateLabel/venueLabel/sourceLabel değerlerini geçirir, burada yalnız görsel üretilir.
export function renderLocalEvent(villa: Villa, format: Format, title: string, dateLabel: string, venueLabel: string): Response {
  const body = venueLabel ? `${dateLabel} · ${venueLabel}` : dateLabel;
  return textCard(villa, format, "YEREL ETKİNLİK", title, body);
}

// ============ Allowlisted public template ID ============
// Format: "<villa>_<type>_<key>" - villa: safira|destan, type: TemplateType, key: destination/
// activity için GUIDE_PLACES id, travel-tip için sayısal index, villa-lifestyle/offer için "default".
// Serbest metin/başlık ASLA kabul edilmez - yalnız bu üç bileşen, üçü de gerçek/sabit listeler
// karşısında doğrulanır. Format ayrıca ayrı bir path segment'i (feed|story).
export interface ParsedTemplateId {
  villa: Villa;
  type: TemplateType;
  key: string;
}

export function parseTemplateId(id: string): ParsedTemplateId | null {
  const parts = id.split("_");
  if (parts.length !== 3) return null;
  const [villaRaw, typeRaw, key] = parts;
  const villa = villaRaw === "safira" ? "Safira" : villaRaw === "destan" ? "Destan" : null;
  if (!villa || !isTemplateType(typeRaw) || !key) return null;
  return { villa, type: typeRaw, key };
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function renderTemplate(parsed: ParsedTemplateId, format: Format): Response | null {
  const { villa, type, key } = parsed;
  if (type === "destination") return renderDestinationOrActivity(villa, format, key, "BÖLGE REHBERİ");
  if (type === "activity") return renderDestinationOrActivity(villa, format, key, "AKTİVİTE ÖNERİSİ");
  if (type === "travel-tip") {
    const index = Number.parseInt(key, 10);
    if (!Number.isInteger(index)) return null;
    return renderTravelTip(villa, format, index);
  }
  if (type === "villa-lifestyle") return key === "default" ? renderVillaLifestyle(villa, format) : null;
  if (type === "offer") return key === "default" ? renderOfferCampaign(villa, format) : null;
  if (type === "trust") {
    const index = Number.parseInt(key, 10);
    if (!Number.isInteger(index)) return null;
    return renderTrustClaim(villa, format, index);
  }
  if (type === "special-day") {
    if (!DATE_KEY_PATTERN.test(key)) return null;
    return renderSpecialDay(villa, format, key);
  }
  // "local-event" bilerek burada YOK - içeriği D1'de saklanan admin-onaylı aday kayıtlarına
  // dayanır, bu yüzden renderLocalEvent ayrı, ASENKRON bir fonksiyondur (bkz. local-events.ts,
  // public route bunu ayrıca çağırır) - bu senkron fonksiyon yalnız statik/sabit tipleri kapsar.
  return null;
}
