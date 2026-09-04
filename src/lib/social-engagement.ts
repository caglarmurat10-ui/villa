import type { Reservation, Villa } from "./types";

// Engagement katmanı: CTA çeşitliliği + native olarak API ile oluşturulamayan story interaction
// şablonları (poll/question/slider stickers - Meta Graph API bunları publish edemez, yalnız insan
// Instagram uygulamasından manuel ekleyebilir). Hiçbir sahte UI overlay üretilmez.

export type CtaStyle = "soru" | "kaydet" | "paylas" | "dm" | "profil-incele";

export const ctaTemplates: Record<CtaStyle, string[]> = {
  soru: [
    "Siz olsanız hangisini seçerdiniz? Yorumlara yazın.",
    "Bu manzarayı gördünüz mü? Yorumlarda favori Patara–Kaş noktanızı paylaşın.",
    "Patara–Kaş planında sizin ilk durağınız neresi olurdu?",
    "Tatil planında sizin için en önemli detay ne? Yorumlara tek kelimeyle yazın.",
    "Bu listeden hangisini bir sonraki gezi planınıza eklersiniz?",
  ],
  kaydet: [
    "Patara–Kaş tatil planınız için bu gönderiyi kaydedin.",
    "Bu rehberi kaydedin; bölge planınızı yaparken sonra tekrar açın.",
    "Bir sonraki Kaş planınızda geri dönmek için kaydetmeyi unutmayın.",
    "Kaydetmelik bir Patara notu: plan yaparken elinizin altında olsun.",
  ],
  paylas: [
    "Birlikte tatile çıkacağınız kişiye gönderin.",
    "Patara planı yapan bir arkadaşınızla paylaşın.",
    "Bu rotayı birlikte denemek istediğiniz kişiye gönderin.",
    "Kaş tarafına yolu düşecek bir arkadaşınız varsa onunla paylaşın.",
  ],
  dm: [
    "Tarihlerinizi gönderin; güncel müsaitliği kontrol edelim.",
    "Detay ve güncel müsaitlik için DM veya WhatsApp'tan yazın.",
  ],
  "profil-incele": [
    "Patara, Kaş ve villa rehberlerinin devamı için profili takip edin.",
    "Villaların gerçek fotoğrafları ve bölge rehberleri için profili inceleyin.",
    "Bölgeyi adım adım keşfetmek için profili takip edin; yeni rehberler burada devam edecek.",
    "Gerçek villa görüntüleri ve kaydetmelik Patara–Kaş notları için profilde kalın.",
  ],
};

// Varsayılan organik rotasyonun hedefi satış baskısı değil; kaydetme, paylaşma, yorum ve profil/
// takip sinyallerini düzenli biçimde çeşitlendirmek. `dm` stili bilinçli olarak burada YOK; dönüşüm
// odaklı bir içerikte explicit olarak pickCtaLine("dm", ...) ile hâlâ kullanılabilir.
const ROTATION_ORDER: CtaStyle[] = ["kaydet", "paylas", "soru", "profil-incele"];

export function ctaStyleForIndex(index: number): CtaStyle {
  return ROTATION_ORDER[index % ROTATION_ORDER.length];
}

// İçeriğin doğal amacına göre CTA sırasını değiştirir. Rota ve ipucu içerikleri önce kaydet/paylaş,
// destinasyon ve gezi içerikleri önce yorum/paylaş sinyali ister. Hiçbir discovery rotasyonunda DM
// veya müsaitlik CTA'sı yoktur.
const THEME_ROTATIONS: Record<string, CtaStyle[]> = {
  "Rota": ["kaydet", "paylas", "profil-incele", "soru"],
  "Yerel İpucu": ["kaydet", "paylas", "profil-incele", "soru"],
  "Bölge": ["soru", "paylas", "kaydet", "profil-incele"],
  "Gezi": ["soru", "paylas", "kaydet", "profil-incele"],
  "Tarih-Doğa": ["kaydet", "soru", "paylas", "profil-incele"],
};

export function ctaStyleForTheme(theme: string, seed: number): CtaStyle {
  const rotation = THEME_ROTATIONS[theme] ?? ROTATION_ORDER;
  return rotation[seed % rotation.length];
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
  { id: "poll-beach-history", kind: "poll", villa: "both", prompt: "Patara'da önce hangisi?", options: ["Plaj", "Antik kent"], manualReady: true },
  { id: "poll-kas-kalkan", kind: "poll", villa: "both", prompt: "Bugün hangi tarafa?", options: ["Kaş", "Kalkan"], manualReady: true },
  { id: "poll-villa-discovery", kind: "poll", villa: "both", prompt: "Tatil gününü nasıl geçirirdiniz?", options: ["Villa günü", "Keşif günü"], manualReady: true },
  { id: "question-villa-curiosity", kind: "question", villa: "both", prompt: "Villa hakkında en çok neyi merak ediyorsunuz?", manualReady: true },
  { id: "question-patara-wishlist", kind: "question", villa: "both", prompt: "Patara'da görmek istediğiniz yeri yazın", manualReady: true },
  { id: "question-next-guide", kind: "question", villa: "both", prompt: "Sıradaki bölge rehberi ne hakkında olsun?", manualReady: true },
  { id: "question-villa-choice", kind: "question", villa: "both", prompt: "Villa seçerken ilk baktığınız detay ne?", manualReady: true },
  { id: "slider-evening-view", kind: "slider", villa: "both", prompt: "Bu akşam manzarasına kaç puan?", manualReady: true },
  { id: "slider-pool-day", kind: "slider", villa: "both", prompt: "Bugün havuz günü olsa?", manualReady: true },
  { id: "slider-patara-route", kind: "slider", villa: "both", prompt: "Patara rotasına ne kadar hazırsınız?", manualReady: true },
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
