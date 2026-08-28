import type { Villa } from "./types";

export type BrandProfile = {
  villa: Villa;
  instagram: {
    profileName: string;
    preferredUsername: string;
    bio: string;
    category: string;
    contactActions: string[];
    highlights: string[];
    pinnedPosts: string[];
    setupChecklist: string[];
  };
  facebook: {
    pageName: string;
    preferredUsername: string;
    category: string;
    intro: string;
    about: string;
    cover: string;
    cta: string;
    pinnedPosts: string[];
    checklist: string[];
  };
  visual: {
    feedRatio: string;
    storyRatio: string;
    colorDirection: string;
    photoRule: string;
    overlayRule: string;
    highlightRule: string;
  };
  launchWeek: Array<{ day: number; main: string; format: string; story: string; goal: string }>;
};

const commonHighlights = ["Villa", "Havuz", "Odalar", "Patara", "Kaş", "Müsaitlik", "İletişim"];
const commonInstagramChecklist = [
  "Profesyonel hesap / işletme profili açık",
  "Kategori görünür: Tatil Konutu Kiralama",
  "Mesaj ve WhatsApp iletişim aksiyonları açık",
  "Konum: Patara / Kaş / Antalya",
  "7 öne çıkan başlığı aynı sırada",
  "İlk 3 sabit gönderi profil vitrini olarak kilitli",
  "Yalnız gerçek villa fotoğrafı/video kullanılıyor",
];

export const brandProfiles: Record<Villa, BrandProfile> = {
  Safira: {
    villa: "Safira",
    instagram: {
      profileName: "Villa Safira Patara",
      preferredUsername: "villasafirapatara",
      bio: "Patara, Kaş’ta özel havuzlu Villa Safira 🌿\nHuzur • Mahremiyet • Doğa\n📍 Patara / Kaş / Antalya\n📩 Rezervasyon & müsaitlik: DM / WhatsApp",
      category: "Tatil Konutu Kiralama",
      contactActions: ["WhatsApp", "Mesaj"],
      highlights: commonHighlights,
      pinnedPosts: ["Villa Safira genel tanıtım", "Villa turu / yaşam alanları", "Rezervasyon / iletişim"],
      setupChecklist: commonInstagramChecklist,
    },
    facebook: {
      pageName: "Villa Safira Patara",
      preferredUsername: "villasafirapatara",
      category: "Tatil Konutu Kiralama",
      intro: "Patara, Kaş’ta özel havuzlu Villa Safira. Güncel müsaitlik ve rezervasyon için mesaj / WhatsApp.",
      about: "Villa Safira · Patara / Kaş / Antalya. Gerçek villa fotoğrafları, güncel müsaitlik duyuruları ve rezervasyon bilgileri bu sayfada paylaşılır.",
      cover: "Gerçek Villa Safira dış cephe/havuz fotoğrafı + sade Villa Safira Patara başlığı",
      cta: "WhatsApp / Mesaj Gönder",
      pinnedPosts: ["Villa Safira genel tanıtım", "Villa turu", "Rezervasyon ve iletişim"],
      checklist: [
        "Profil fotoğrafı Villa Safira marka standardında",
        "Kapak yalnız gerçek Villa Safira fotoğrafından",
        "Giriş ve Hakkında alanları güncel",
        "WhatsApp / Mesaj Gönder CTA aktif",
        "Konum Patara / Kaş / Antalya olarak kontrol edildi",
        "Instagram hesabı ile bağlantı kontrol edildi",
        "İlk 3 sabit gönderi profil vitrini olarak ayarlandı",
      ],
    },
    visual: {
      feedRatio: "Feed ana formatı 4:5 (1080×1350); kare yalnız gerektiğinde",
      storyRatio: "Story / Reels 9:16 (1080×1920)",
      colorDirection: "Lacivert + altın marka detayları; doğal villa renkleri korunur",
      photoRule: "Yalnızca gerçek Villa Safira fotoğraf/video; doğal renkler, ağır filtre yok",
      overlayRule: "Fiyat bindirmesi yalnız güncel rezervasyon verisiyle; diğer içerikte küçük marka adı + kısa başlık",
      highlightRule: "Tek tip lacivert-altın öne çıkan kapakları; sıra sabit",
    },
    launchWeek: [
      { day: 1, main: "Genel villa tanıtımı", format: "Reels", story: "Anket: Havuz mu manzara mı?", goal: "Marka yeniden tanıtımı" },
      { day: 2, main: "Havuz + doğa", format: "Feed", story: "Soru: Tatilde ilk yaptığın şey?", goal: "Etkileşim" },
      { day: 3, main: "Salon / yaşam alanı", format: "Carousel", story: "Oda mı salon mu?", goal: "Villa içini göster" },
      { day: 4, main: "Patara/Kaş bölge fikri", format: "Story", story: "Mini rota", goal: "Bölgesel erişim" },
      { day: 5, main: "Villa detayları", format: "Reels", story: "Emoji slider", goal: "Detay + duygu" },
      { day: 6, main: "Gerçek müsaitlik", format: "Feed", story: "Tarih soru etiketi", goal: "Lead" },
      { day: 7, main: "Hafta özeti / villa turu", format: "Carousel", story: "Haftanın favorisi anketi", goal: "Takip + kayıt" },
    ],
  },
  Destan: {
    villa: "Destan",
    instagram: {
      profileName: "Villa Destan Patara",
      preferredUsername: "villadestanpatara",
      bio: "Patara, Kaş’ta özel havuzlu Villa Destan 🌿\nKonfor • Huzur • Doğa\n📍 Patara / Kaş / Antalya\n📩 Rezervasyon & müsaitlik: DM / WhatsApp",
      category: "Tatil Konutu Kiralama",
      contactActions: ["WhatsApp", "Mesaj"],
      highlights: commonHighlights,
      pinnedPosts: ["Drone / genel Villa Destan tanıtımı", "Villa turu / yaşam alanları", "Rezervasyon / iletişim"],
      setupChecklist: commonInstagramChecklist,
    },
    facebook: {
      pageName: "Villa Destan Patara",
      preferredUsername: "villadestanpatara",
      category: "Tatil Konutu Kiralama",
      intro: "Patara, Kaş’ta özel havuzlu Villa Destan. Güncel müsaitlik ve rezervasyon için mesaj / WhatsApp.",
      about: "Villa Destan · Patara / Kaş / Antalya. Gerçek villa ve drone görüntüleri, güncel müsaitlik duyuruları ve rezervasyon bilgileri bu sayfada paylaşılır.",
      cover: "Gerçek Villa Destan havuz/dış cephe veya drone fotoğrafı + sade Villa Destan Patara başlığı",
      cta: "WhatsApp / Mesaj Gönder",
      pinnedPosts: ["Villa Destan drone/genel tanıtım", "Villa turu", "Rezervasyon ve iletişim"],
      checklist: [
        "Profil fotoğrafı Villa Destan marka standardında",
        "Kapak yalnız gerçek Villa Destan fotoğrafından",
        "Giriş ve Hakkında alanları güncel",
        "WhatsApp / Mesaj Gönder CTA aktif",
        "Konum Patara / Kaş / Antalya olarak kontrol edildi",
        "Instagram hesabı ile bağlantı kontrol edildi",
        "İlk 3 sabit gönderi profil vitrini olarak ayarlandı",
      ],
    },
    visual: {
      feedRatio: "Feed ana formatı 4:5 (1080×1350); kare yalnız gerektiğinde",
      storyRatio: "Story / Reels 9:16 (1080×1920)",
      colorDirection: "Safira ile ortak lacivert-altın sistem; Destan adı ayrı ve net",
      photoRule: "Yalnızca gerçek Villa Destan fotoğraf/video; drone avantajı kullanılır, ağır filtre yok",
      overlayRule: "Fiyat bindirmesi yalnız güncel rezervasyon verisiyle; diğer içerikte küçük marka adı + kısa başlık",
      highlightRule: "Safira ile aynı tek tip lacivert-altın öne çıkan kapak sistemi; sıra sabit",
    },
    launchWeek: [
      { day: 1, main: "Drone ile genel villa tanıtımı", format: "Reels", story: "Anket: Havuz mu manzara mı?", goal: "Marka yeniden tanıtımı" },
      { day: 2, main: "Havuz + akşam atmosferi", format: "Feed", story: "Soru: Tatilde ilk yaptığın şey?", goal: "Etkileşim" },
      { day: 3, main: "Salon / yaşam alanı", format: "Carousel", story: "Oda mı salon mu?", goal: "Villa içini göster" },
      { day: 4, main: "Patara/Kaş bölge fikri", format: "Story", story: "Mini rota", goal: "Bölgesel erişim" },
      { day: 5, main: "Villa detayları", format: "Reels", story: "Emoji slider", goal: "Detay + duygu" },
      { day: 6, main: "Gerçek müsaitlik", format: "Feed", story: "Tarih soru etiketi", goal: "Lead" },
      { day: 7, main: "Hafta özeti / drone turu", format: "Carousel", story: "Haftanın favorisi anketi", goal: "Takip + kayıt" },
    ],
  },
};
