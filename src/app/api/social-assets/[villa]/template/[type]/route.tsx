import { ImageResponse } from "next/og";
import { GUIDE_PLACES, GUIDE_CATEGORIES } from "@/lib/region-guide";
import { socialDriveMedia } from "@/lib/social-drive-media";
import type { Villa } from "@/lib/types";

export const runtime = "nodejs";

// FAZ 5 bölüm 4 - Social Design Engine: 5 yeniden kullanılabilir şablon (Destination Guide,
// Activity Idea, Villa Lifestyle, Travel Tip, Offer/Campaign), Feed (1080x1350) ve Story/Reel
// (1080x1920) formatları. Mevcut ImageResponse altyapısı (src/app/api/social-assets/[villa]/
// [asset]/route.tsx - koyu lacivert/altın marka dili) yeniden kullanıldı, sıfırdan icat edilmedi.
//
// PROVENANCE GÜVENLİĞİ:
//  - "Destination Guide"/"Activity Idea"/"Travel Tip" şablonları hiçbir villa/genel fotoğrafı
//    belirli bir bölge yeriymiş gibi GÖSTERMEZ - yalnız metin/marka kartı (fotoğraf yok). Bölgede
//    gerçek, doğrulanmış (bkz. region-guide.ts) yer fotoğrafımız olmadığı için bu bilinçli bir
//    tercih: "Generic villa fotoğrafını 'Patara Plajı' diye etiketleme YOK" kuralına birebir uyar.
//  - "Villa Lifestyle"/"Offer" şablonları YALNIZ gerçek, Drive'dan çözümlenmiş villa fotoğraflarını
//    kullanır (socialDriveMedia - social-drive-media.ts, zaten onaylı/lisanslı envanter).
//  - "Destination Guide"/"Activity Idea" içeriği YALNIZ GUIDE_PLACES'teki (region-guide.ts, 2026-09-01
//    çok kaynaklı doğrulanmış) sabit/tarihsel açıklamalardan gelir - fiyat/saat/ücret/hava/tarih gibi
//    DEĞİŞKEN bilgi bu veri modelinde YOK, dolayısıyla burada da asla üretilmez.

type TemplateType = "destination" | "activity" | "villa-lifestyle" | "travel-tip" | "offer";
type Format = "feed" | "story";

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

function isVilla(value: string): value is Villa {
  return value === "Safira" || value === "Destan";
}

function isTemplateType(value: string): value is TemplateType {
  return ["destination", "activity", "villa-lifestyle", "travel-tip", "offer"].includes(value);
}

// Ortak marka altlığı (monogram + villa adı) - her şablonun altında/üstünde tutarlı kimlik.
function BrandFooter({ villa }: { villa: Villa }) {
  const brand = BRAND[villa];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ width: 56, height: 56, border: `2px solid ${GOLD}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: GOLD }}>{brand.monogram}</div>
      <div style={{ fontFamily: "sans-serif", fontSize: 20, letterSpacing: 4, color: CREAM }}>{brand.name}</div>
    </div>
  );
}

// Destination Guide / Activity Idea - metin-odaklı kart, fotoğraf YOK (bkz. dosya başı provenance notu).
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

function destinationOrActivity(villa: Villa, format: Format, placeId: string, kicker: string) {
  const place = GUIDE_PLACES.find((item) => item.id === placeId);
  if (!place) return new Response("Rehber yeri bulunamadı.", { status: 404 });
  const categoryLabel = GUIDE_CATEGORIES.find((c) => c.slug === place.category)?.label ?? place.category;
  return textCard(villa, format, `${kicker} · ${categoryLabel.toUpperCase()}`, place.name, place.description);
}

// Travel Tip - sabit, doğrulanmamış/değişken bilgi İÇERMEYEN genel/evergreen öneriler. Havadan,
// fiyattan, saatten BAĞIMSIZ - listedeki her ipucu tarihsiz kalır (bkz. classifyContentSafety
// aynı desen kuralları, social-content-planner.ts).
const EVERGREEN_TIPS = [
  "Patara'nın uzun kumsalı deniz kaplumbağalarının koruma alanıdır - akşam saatlerinde kumsalda ışık kullanımına dikkat edilmesi istenir.",
  "Kaş ve Patara çevresinde araç kiralamak, bölgedeki antik kentleri kendi temponuzda gezmek için pratik bir seçenektir.",
  "Likya bölgesindeki antik kentleri gezerken rahat yürüyüş ayakkabısı ve şapka bulundurmanız öneriliriz.",
  "Villa Safira ve Villa Destan'dan çevredeki koylara ve antik kentlere kendi aracınızla ulaşmak mümkündür.",
];

function travelTip(villa: Villa, format: Format, tipIndex: number) {
  const tip = EVERGREEN_TIPS[tipIndex % EVERGREEN_TIPS.length];
  return textCard(villa, format, "GEZİ İPUCU", "Bölgeyi keşfederken", tip);
}

// Villa Lifestyle / Offer - YALNIZ gerçek, Drive'dan çözümlenmiş villa fotoğrafı (socialDriveMedia).
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

function villaLifestyle(villa: Villa, format: Format) {
  const line = villa === "Safira" ? "Doğayla iç içe, sakin bir Patara tatili." : "Mahremiyet odaklı, akşamları güzelleşen bir kaçış.";
  return photoCard(villa, format, "VILLA YAŞAM", `${BRAND[villa].name.split(" ")[1] ?? villa} Patara`, line);
}

function offerCampaign(villa: Villa, format: Format) {
  // Fiyat/taksit UYDURULMAZ - yalnız genel, her zaman doğru olan "doğrudan rezervasyon" mesajı.
  // Gerçek fiyat/kampanya iddiaları yalnız canonical price-engine.ts kaynağından, doğrulanmış
  // durumlarda (installment-campaign.ts VERIFIED) ayrı bir aşamada eklenmelidir.
  return photoCard(villa, format, "DOĞRUDAN REZERVASYON", "Aracısız, doğrudan sizinle.", "Gerçek müsaitlik ve dönemsel fiyat, doğrudan rezervasyon.");
}

export async function GET(request: Request, context: { params: Promise<{ villa: string; type: string }> }) {
  const { villa, type } = await context.params;
  if (!isVilla(villa)) return new Response("Villa bulunamadı.", { status: 404 });
  if (!isTemplateType(type)) return new Response("Şablon türü bulunamadı.", { status: 404 });

  const url = new URL(request.url);
  const formatParam = url.searchParams.get("format");
  const format: Format = formatParam === "story" ? "story" : "feed";

  if (type === "destination") {
    const placeId = url.searchParams.get("placeId") ?? "";
    return destinationOrActivity(villa, format, placeId, "BÖLGE REHBERİ");
  }
  if (type === "activity") {
    const placeId = url.searchParams.get("placeId") ?? "";
    return destinationOrActivity(villa, format, placeId, "AKTİVİTE ÖNERİSİ");
  }
  if (type === "villa-lifestyle") return villaLifestyle(villa, format);
  if (type === "travel-tip") {
    const tipIndex = Number.parseInt(url.searchParams.get("tip") ?? "0", 10) || 0;
    return travelTip(villa, format, tipIndex);
  }
  if (type === "offer") return offerCampaign(villa, format);

  return new Response("Şablon türü bulunamadı.", { status: 404 });
}
