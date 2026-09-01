import type { Reservation, Villa } from "./types";

// Engagement katmanı: CTA çeşitliliği + native olarak API ile oluşturulamayan story interaction
// şablonları (poll/question/slider stickers - Meta Graph API bunları publish edemez, yalnız insan
// Instagram uygulamasından manuel ekleyebilir). Hiçbir sahte UI overlay üretilmez.

export type CtaStyle = "soru" | "kaydet" | "paylas" | "dm" | "profil-incele";

export const ctaTemplates: Record<CtaStyle, string[]> = {
  soru: [
    "Siz olsanız hangisini seçerdiniz?",
    "Bu manzarayı gördünüz mü hiç?",
  ],
  kaydet: [
    "Bu fikri kaydedin; konaklama için güncel müsaitliği sorun.",
    "Patara–Kaş tatil planınız için gönderiyi kaydedin.",
  ],
  paylas: [
    "Tatil planınızdaki birine gösterin.",
    "Birlikte tatile çıkacağınız birine paylaşın.",
  ],
  dm: [
    "Tarihlerinizi gönderin; güncel müsaitliği kontrol edelim.",
    "Detay ve güncel müsaitlik için DM veya WhatsApp'tan yazın.",
  ],
  "profil-incele": [
    "Villanın diğer gerçek fotoğrafları için profili inceleyin.",
    "Villanın diğer detayları için profili inceleyin.",
  ],
};

// Rotasyon sırası - aynı stil art arda kullanılmasın diye basit round-robin. Her post CTA ile
// boğulmasın diye bilerek TEK cümlelik, mevcut caption yapısının sonuna eklenen bir satır.
const ROTATION_ORDER: CtaStyle[] = ["dm", "kaydet", "profil-incele", "soru", "paylas"];

export function ctaStyleForIndex(index: number): CtaStyle {
  return ROTATION_ORDER[index % ROTATION_ORDER.length];
}

export function pickCtaLine(style: CtaStyle, seed: number): string {
  const options = ctaTemplates[style];
  return options[seed % options.length];
}

export type StoryInteractionKind = "poll" | "question" | "slider";

export interface StoryInteractionTemplate {
  id: string;
  kind: StoryInteractionKind;
  villa: "Safira" | "Destan" | "both";
  prompt: string;
  options?: string[];
  manualReady: true; // Meta Graph API native story sticker (poll/question/slider) publish EDEMEZ - bu şablonlar yalnız insanın Instagram uygulamasından manuel ekleyeceği bir referans.
}

export const storyInteractionTemplates: StoryInteractionTemplate[] = [
  { id: "poll-pool-patara", kind: "poll", villa: "both", prompt: "Bugün hangisini seçerdiniz?", options: ["Havuz", "Patara"], manualReady: true },
  { id: "poll-privacy-location", kind: "poll", villa: "both", prompt: "Tatilde sizin için hangisi daha önemli?", options: ["Mahremiyet", "Konum"], manualReady: true },
  { id: "question-villa-curiosity", kind: "question", villa: "both", prompt: "Villa hakkında en çok neyi merak ediyorsunuz?", manualReady: true },
  { id: "question-patara-wishlist", kind: "question", villa: "both", prompt: "Patara'da görmek istediğiniz yeri yazın", manualReady: true },
  { id: "slider-evening-view", kind: "slider", villa: "both", prompt: "Bu akşam manzarasına kaç puan?", manualReady: true },
];

// Google yorum isteği - yalnız GBP'den alınan GERÇEK "Yorum iste" linki yapılandırıldığında
// bir mesaj üretir (link URL'si ASLA tahmin edilmez - villa-content.ts'te veya env'de yoksa null).
// Hediye/indirim karşılığı yorum YOK, negatif yorumu engelleyen bir gating YOK - herkese aynı
// nazik davet. Otomatik gönderim yapılmaz; bu yalnız personelin WhatsApp'tan manuel kullanacağı
// hazır bir metin şablonudur (bu sistemde WhatsApp Business API entegrasyonu yok).
export function getReviewRequestMessage(villa: Villa, guestName: string, reviewUrl: string | null): string | null {
  if (!reviewUrl) return null;
  const firstName = guestName.trim().split(/\s+/)[0] || "Merhaba";
  return `${firstName}, Villa ${villa}'da geçirdiğiniz zaman için teşekkür ederiz! Deneyiminizi Google'da paylaşmak isterseniz çok memnun oluruz: ${reviewUrl}`;
}

// Checkout'tan bugüne 0-2 gün geçmiş rezervasyonlar - "review request gönderilebilir" adayları.
// Yalnız gerçek misafir (gerçek rezervasyon), indirim/ödül koşulu yok.
export function reservationsEligibleForReviewRequest(reservations: Reservation[], todayIso: string): Reservation[] {
  const today = Date.parse(todayIso);
  return reservations.filter((r) => {
    const checkOut = Date.parse(r.checkOut);
    if (!Number.isFinite(checkOut) || !Number.isFinite(today)) return false;
    const daysSince = (today - checkOut) / (24 * 60 * 60 * 1000);
    return daysSince >= 0 && daysSince <= 2;
  });
}

// 30 günlük hedef içerik dağılımı - operasyonel hedef, D1'e yazılan bir kısıt değil. Admin panelinde
// gerçek dağılımla karşılaştırmak için referans.
export const CONTENT_MIX_TARGET = {
  villaOzellik: 40,
  bolgeRehber: 20,
  experienceLifestyle: 15,
  faq: 10,
  gercekAvailability: 10,
  socialProof: 5,
} as const;
