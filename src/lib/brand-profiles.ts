import type { Villa } from "./types";

export type BrandProfile = {
  villa: Villa;
  instagram: {
    profileName: string;
    username: string | null;
    bio: string;
    highlights: string[];
    pinnedPosts: string[];
  };
  facebook: {
    pageName: string;
    category: string;
    cover: string;
    cta: string;
    checklist: string[];
  };
  visual: {
    feedRatio: string;
    colorDirection: string;
    photoRule: string;
    overlayRule: string;
    highlightRule: string;
  };
  launchWeek: Array<{ day: number; main: string; format: string; story: string; goal: string }>;
};

const commonHighlights = ["Villa", "Havuz", "Odalar", "Patara", "Kaş", "Müsaitlik", "İletişim"];

export const brandProfiles: Record<Villa, BrandProfile> = {
  Safira: {
    villa: "Safira",
    instagram: {
      profileName: "Villa Safira Patara",
      username: "@villasafirapatara",
      bio: "Patara, Kaş’ta özel havuzlu Villa Safira 🌿\nHuzur • Mahremiyet • Doğa\n📍 Patara / Kaş / Antalya\n📩 Rezervasyon & müsaitlik için DM / WhatsApp",
      highlights: commonHighlights,
      pinnedPosts: ["Villa tanıtım", "Villa turu", "Rezervasyon / iletişim"],
    },
    facebook: {
      pageName: "Villa Safira Patara",
      category: "Tatil Konutu Kiralama",
      cover: "Gerçek villa fotoğrafı + sade marka başlığı",
      cta: "WhatsApp / Mesaj",
      checklist: ["Profil fotoğrafı marka standardında", "Kapak gerçek villa fotoğrafı", "Bio Instagram ile aynı dilde", "WhatsApp/Mesaj CTA aktif", "Site ve iletişim linkleri kontrol edildi"],
    },
    visual: {
      feedRatio: "Instagram 4:5 öncelikli; Facebook aynı ana görseli kullanabilir",
      colorDirection: "Lacivert + altın marka detayları; doğal villa renkleri korunur",
      photoRule: "Yalnızca gerçek Villa Safira fotoğraf/video; doğal renkler, ağır filtre yok",
      overlayRule: "Büyük fiyat/metin bindirme yok; gerekirse küçük marka adı + kısa başlık",
      highlightRule: "Tek tip lacivert-altın öne çıkan kapakları",
    },
    launchWeek: [
      { day: 1, main: "Genel villa tanıtımı", format: "Reels", story: "Anket: Havuz mu manzara mı?", goal: "Marka yeniden tanıtımı" },
      { day: 2, main: "Havuz + doğa", format: "Feed", story: "Soru: Tatilde ilk yaptığın şey?", goal: "Etkileşim" },
      { day: 3, main: "Salon / yaşam alanı", format: "Carousel", story: "Oda mı salon mu?", goal: "Villa içini göster" },
      { day: 4, main: "Patara/Kaş bölge fikri", format: "Story", story: "Mini rota", goal: "Bölgesel erişim" },
      { day: 5, main: "Jakuzili oda / detay", format: "Reels", story: "Emoji slider", goal: "Detay + duygu" },
      { day: 6, main: "Gerçek müsaitlik", format: "Feed", story: "Tarih soru etiketi", goal: "Lead" },
      { day: 7, main: "Hafta özeti / villa turu", format: "Carousel", story: "Haftanın favorisi anketi", goal: "Takip + kayıt" },
    ],
  },
  Destan: {
    villa: "Destan",
    instagram: {
      profileName: "Villa Destan Patara",
      username: null,
      bio: "Patara, Kaş’ta özel havuzlu Villa Destan 🌿\nKonfor • Huzur • Doğa\n📍 Patara / Kaş / Antalya\n📩 Rezervasyon & müsaitlik için DM / WhatsApp",
      highlights: commonHighlights,
      pinnedPosts: ["Drone villa tanıtım", "Villa turu", "Rezervasyon / iletişim"],
    },
    facebook: {
      pageName: "Villa Destan Patara",
      category: "Tatil Konutu Kiralama",
      cover: "Instagram ile aynı marka standardı + gerçek Villa Destan görseli",
      cta: "WhatsApp / Mesaj",
      checklist: ["Profil fotoğrafı marka standardında", "Kapak ve bio kontrol edildi", "WhatsApp/Mesaj CTA aktif", "Site ve iletişim linkleri kontrol edildi", "Instagram ile aynı marka dili"],
    },
    visual: {
      feedRatio: "Instagram 4:5 öncelikli; Facebook aynı ana görseli kullanabilir",
      colorDirection: "Safira ile ortak lacivert-altın sistem; Destan adı ayrı ve net",
      photoRule: "Yalnızca gerçek Villa Destan fotoğraf/video; drone avantajı kullanılır, ağır filtre yok",
      overlayRule: "Büyük fiyat/metin bindirme yok; gerekirse küçük marka adı + kısa başlık",
      highlightRule: "Safira ile aynı tek tip lacivert-altın öne çıkan kapak sistemi",
    },
    launchWeek: [
      { day: 1, main: "Drone ile genel villa tanıtımı", format: "Reels", story: "Anket: Havuz mu manzara mı?", goal: "Marka yeniden tanıtımı" },
      { day: 2, main: "Havuz + akşam atmosferi", format: "Feed", story: "Soru: Tatilde ilk yaptığın şey?", goal: "Etkileşim" },
      { day: 3, main: "Salon / yaşam alanı", format: "Carousel", story: "Oda mı salon mu?", goal: "Villa içini göster" },
      { day: 4, main: "Patara/Kaş bölge fikri", format: "Story", story: "Mini rota", goal: "Bölgesel erişim" },
      { day: 5, main: "Jakuzili oda / detay", format: "Reels", story: "Emoji slider", goal: "Detay + duygu" },
      { day: 6, main: "Gerçek müsaitlik", format: "Feed", story: "Tarih soru etiketi", goal: "Lead" },
      { day: 7, main: "Hafta özeti / drone turu", format: "Carousel", story: "Haftanın favorisi anketi", goal: "Takip + kayıt" },
    ],
  },
};
