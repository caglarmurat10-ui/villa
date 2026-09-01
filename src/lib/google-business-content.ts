import type { Villa } from "./types";

// Google Business Profile owner/API erişimi doğrulanınca kullanılmak üzere HAZIR içerik kütüphanesi.
// GBP API erişimi olmadan hiçbir publish denemesi yapılmaz (bkz. google-visibility.ts'in
// gbpState'i her zaman en az WAITING_OWNER_ACCESS). Yalnız gerçek villa-content.ts verisinden
// türetilmiş metinler - uydurma özellik/fiyat/availability yok.
export type GbpPostCategory = "villa-tanitim" | "havuz-bahce" | "oda" | "rehber" | "sezon";

export interface GbpPostDraft {
  villa: Villa;
  category: GbpPostCategory;
  title: string;
  body: string;
  mediaHint: string;
}

export const gbpContentLibrary: GbpPostDraft[] = [
  {
    villa: "Safira",
    category: "villa-tanitim",
    title: "Villa Safira · Patara / Kaş",
    body: "Patara'nın doğal dokusu içinde, özel havuzunuzdan ve bağımsız yaşam alanınızdan vazgeçmeden sakin bir Akdeniz tatili. Güncel müsaitlik ve rezervasyon için DM veya WhatsApp.",
    mediaHint: "safira-havuz-genel-manzara.jpg",
  },
  {
    villa: "Safira",
    category: "havuz-bahce",
    title: "Villa Safira · Özel Havuz",
    body: "Villa Safira'nın özel havuzu ve doğa manzarası — gün boyu kendinize ait bir alan.",
    mediaHint: "safira-havuz-doga.jpg",
  },
  {
    villa: "Safira",
    category: "oda",
    title: "Villa Safira · Yatak Odaları",
    body: "İki yatak odası, her biri özel banyo ve jakuzili — Villa Safira'da konfor ayrıntıda.",
    mediaHint: "safira-yatak-odasi.jpg",
  },
  {
    villa: "Safira",
    category: "rehber",
    title: "Patara ve Kaş'ta bir gün",
    body: "Villa Safira, Patara ve Kaş'ı kendi temponuzda keşfetmek için doğal bir üs. Bölge rehberimizi safiradestan.com/rehber adresinde bulabilirsiniz.",
    mediaHint: "region-guide",
  },
  {
    villa: "Destan",
    category: "villa-tanitim",
    title: "Villa Destan · Patara / Kaş",
    body: "Patara'da özel havuzlu, geniş yaşam alanlarıyla Villa Destan. Güncel müsaitlik ve rezervasyon için DM veya WhatsApp.",
    mediaHint: "destan-drone-genel-gorunum.jpg",
  },
  {
    villa: "Destan",
    category: "havuz-bahce",
    title: "Villa Destan · Akşam Havuz",
    body: "Villa Destan'da akşam ışıkları ve özel havuz — sakin bir tatil akşamı.",
    mediaHint: "destan-aksam-havuz.jpg",
  },
  {
    villa: "Destan",
    category: "oda",
    title: "Villa Destan · Yatak Odaları",
    body: "Üç yatak odası, jakuzili seçenekler dahil — Villa Destan'da herkese yer var.",
    mediaHint: "destan-jakuzili-yatak-odasi.jpg",
  },
  {
    villa: "Destan",
    category: "rehber",
    title: "Patara ve Kaş'ta bir gün",
    body: "Villa Destan, Patara ve Kaş'ı kendi temponuzda keşfetmek için doğal bir üs. Bölge rehberimizi safiradestan.com/rehber adresinde bulabilirsiniz.",
    mediaHint: "region-guide",
  },
];

// "sezon" kategorisi bilerek burada YOK - gerçek sezon/availability bilgisi yalnız publish anında
// Villa Yönetim'den hesaplanmalı (bkz. social automation'daki aynı kural), statik metin olarak
// önceden yazılamaz.
