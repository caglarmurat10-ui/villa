import type { Villa } from "./types";
import { WHATSAPP_PHONE_DISPLAY_TR } from "./contact";

// Google Business Profile owner/API erişimi doğrulanınca kullanılmak üzere HAZIR içerik kütüphanesi.
// GBP API erişimi olmadan hiçbir publish denemesi yapılmaz (bkz. google-visibility.ts'in
// gbpState'i her zaman en az WAITING_OWNER_ACCESS). Yalnız gerçek villa-content.ts/region-guide.ts
// verisinden türetilmiş metinler - uydurma özellik/fiyat/availability yok.
export type GbpPostCategory =
  | "villa-tanitim" | "havuz-bahce" | "oda" | "yasam-alani"
  | "patara" | "patara-plaji" | "patara-antik-kenti" | "kas" | "kalkan"
  | "tatil-onerisi" | "rezervasyon-iletisim" | "sezon-evergreen";

export type GbpPostCta = "website" | "whatsapp" | null;

export interface GbpPostDraft {
  villa: Villa;
  category: GbpPostCategory;
  title: string;
  body: string;
  mediaHint: string;
  cta: GbpPostCta;
}

const SAFIRA_URL = "safiradestan.com/villa-safira";
const DESTAN_URL = "safiradestan.com/villa-destan";

export const gbpContentLibrary: GbpPostDraft[] = [
  // --- Villa Safira ---
  { villa: "Safira", category: "villa-tanitim", title: "Villa Safira · Patara / Kaş", body: "Patara'nın doğal dokusu içinde, özel havuzunuzdan ve bağımsız yaşam alanınızdan vazgeçmeden sakin bir Akdeniz tatili. Detaylar için web sitemize göz atın.", mediaHint: "safira-havuz-genel-manzara.jpg", cta: "website" },
  { villa: "Safira", category: "havuz-bahce", title: "Villa Safira · Özel Havuz", body: "Villa Safira'nın özel havuzu ve doğa manzarası — gün boyu kendinize ait bir alan.", mediaHint: "safira-havuz-doga.jpg", cta: null },
  { villa: "Safira", category: "oda", title: "Villa Safira · Yatak Odaları", body: "İki yatak odası, her biri özel banyo ve jakuzili — Villa Safira'da konfor ayrıntıda.", mediaHint: "safira-yatak-odasi.jpg", cta: null },
  { villa: "Safira", category: "yasam-alani", title: "Villa Safira · Salon ve Yemek Alanı", body: "Ferah salon ve yemek alanı, gün boyu doğal ışık alan bir yaşam alanı.", mediaHint: "safira-salon-yemek.jpg", cta: null },
  { villa: "Safira", category: "patara", title: "Villa Safira'dan Patara'ya", body: "Villa Safira, Patara Antik Kenti ve Patara Plajı'na yakın konumuyla tarih ve deniz tatilini bir arada sunuyor.", mediaHint: "region-guide:patara", cta: "website" },
  { villa: "Safira", category: "patara-plaji", title: "Patara Plajı — Villa Safira'ya Yakın", body: "Uzun, ince kumlu Patara Plajı, Caretta caretta koruma alanı olarak biliniyor. Villa Safira'dan bir günlük plan için idealdir.", mediaHint: "region-guide:patara-plaji", cta: "website" },
  { villa: "Safira", category: "patara-antik-kenti", title: "Patara Antik Kenti", body: "Likya Birliği'nin yönetim merkezi olan Patara Antik Kenti, Villa Safira'ya yakın bir tarih durağı.", mediaHint: "region-guide:patara-antik-kenti", cta: "website" },
  { villa: "Safira", category: "kas", title: "Kaş'ı Keşfedin", body: "Tarihi limanı ve Likya kalıntılarıyla bilinen Kaş, Villa Safira'dan gezi rotanıza dahil edebileceğiniz bir durak.", mediaHint: "region-guide:kas", cta: "website" },
  { villa: "Safira", category: "kalkan", title: "Kalkan'a Bir Uzanma", body: "Beyaz badanalı evleri ve marinasıyla Kalkan, şık bir sahil kasabası deneyimi sunuyor.", mediaHint: "region-guide:kalkan", cta: "website" },
  { villa: "Safira", category: "tatil-onerisi", title: "Villa Safira'da Bir Gün", body: "Sabah havuz başında başlayın, günü Patara/Kaş çevresinde geçirin, akşam yeniden villanın sakinliğine dönün.", mediaHint: "safira-havuz-aktivite.jpg", cta: null },
  { villa: "Safira", category: "rezervasyon-iletisim", title: "Villa Safira · Rezervasyon", body: `Villa Safira için güncel müsaitlik ve rezervasyon bilgisi almak isterseniz WhatsApp'tan yazabilirsiniz: ${WHATSAPP_PHONE_DISPLAY_TR}`, mediaHint: "safira-havuz-genis-aci.jpg", cta: "whatsapp" },
  { villa: "Safira", category: "sezon-evergreen", title: "Villa Safira · Gerçek Fotoğraflar", body: "Villa Safira'da paylaştığımız tüm görseller gerçek villa fotoğraf ve videolarıdır — konaklama deneyimini olduğu gibi gösteriyoruz.", mediaHint: "safira-mutfak.jpg", cta: "website" },

  // --- Villa Destan ---
  { villa: "Destan", category: "villa-tanitim", title: "Villa Destan · Patara / Kaş", body: "Patara'da özel havuzlu, geniş yaşam alanlarıyla Villa Destan. Detaylar için web sitemize göz atın.", mediaHint: "destan-drone-genel-gorunum.jpg", cta: "website" },
  { villa: "Destan", category: "havuz-bahce", title: "Villa Destan · Akşam Havuz", body: "Villa Destan'da akşam ışıkları ve özel havuz — sakin bir tatil akşamı.", mediaHint: "destan-aksam-havuz.jpg", cta: null },
  { villa: "Destan", category: "oda", title: "Villa Destan · Yatak Odaları", body: "Üç yatak odası, jakuzili seçenekler dahil — Villa Destan'da herkese yer var.", mediaHint: "destan-jakuzili-yatak-odasi.jpg", cta: null },
  { villa: "Destan", category: "yasam-alani", title: "Villa Destan · Salon ve Yemek Alanı", body: "Geniş salon ve yemek alanı, Villa Destan'ın günlük yaşam merkezini oluşturuyor.", mediaHint: "destan-salon-yemek.jpg", cta: null },
  { villa: "Destan", category: "patara", title: "Villa Destan'dan Patara'ya", body: "Villa Destan, Patara Antik Kenti ve Patara Plajı'na yakın konumuyla tarih ve deniz tatilini bir arada sunuyor.", mediaHint: "region-guide:patara", cta: "website" },
  { villa: "Destan", category: "patara-plaji", title: "Patara Plajı — Villa Destan'a Yakın", body: "Uzun, ince kumlu Patara Plajı, Caretta caretta koruma alanı olarak biliniyor. Villa Destan'dan bir günlük plan için idealdir.", mediaHint: "region-guide:patara-plaji", cta: "website" },
  { villa: "Destan", category: "patara-antik-kenti", title: "Patara Antik Kenti", body: "Likya Birliği'nin yönetim merkezi olan Patara Antik Kenti, Villa Destan'a yakın bir tarih durağı.", mediaHint: "region-guide:patara-antik-kenti", cta: "website" },
  { villa: "Destan", category: "kas", title: "Kaş'ı Keşfedin", body: "Tarihi limanı ve Likya kalıntılarıyla bilinen Kaş, Villa Destan'dan gezi rotanıza dahil edebileceğiniz bir durak.", mediaHint: "region-guide:kas", cta: "website" },
  { villa: "Destan", category: "kalkan", title: "Kalkan'a Bir Uzanma", body: "Beyaz badanalı evleri ve marinasıyla Kalkan, şık bir sahil kasabası deneyimi sunuyor.", mediaHint: "region-guide:kalkan", cta: "website" },
  { villa: "Destan", category: "tatil-onerisi", title: "Villa Destan'da Bir Gün", body: "Sabah havuz başında başlayın, günü Patara/Kaş çevresinde geçirin, akşam yeniden villanın sakinliğine dönün.", mediaHint: "destan-havuzbasi.jpg", cta: null },
  { villa: "Destan", category: "rezervasyon-iletisim", title: "Villa Destan · Rezervasyon", body: `Villa Destan için güncel müsaitlik ve rezervasyon bilgisi almak isterseniz WhatsApp'tan yazabilirsiniz: ${WHATSAPP_PHONE_DISPLAY_TR}`, mediaHint: "destan-gece-havuz.jpg", cta: "whatsapp" },
  { villa: "Destan", category: "sezon-evergreen", title: "Villa Destan · Gerçek Fotoğraflar", body: "Villa Destan'da paylaştığımız tüm görseller gerçek villa fotoğraf ve videolarıdır — konaklama deneyimini olduğu gibi gösteriyoruz.", mediaHint: "destan-mutfak.jpg", cta: "website" },
];

export const GBP_WEBSITE_LINKS: Record<Villa, string> = { Safira: SAFIRA_URL, Destan: DESTAN_URL };

// Müsaitlik/fiyat içeren bir GBP post kategorisi BİLEREK yok - gerçek availability yalnız publish
// anında Villa Yönetim'den hesaplanmalı, statik metin olarak önceden yazılamaz (mevcut sosyal
// otomasyon kuralıyla aynı disiplin).
