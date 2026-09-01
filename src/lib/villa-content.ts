import type { Villa } from "./types";

export type VillaSlug = "villa-safira" | "villa-destan";

export interface VillaHighlight {
  title: string;
  description: string;
}

export interface VillaFaq {
  question: string;
  answer: string;
}

export type GalleryCategorySlug = "havuz" | "dis-mekan" | "odalar" | "salon" | "manzara";

export const GALLERY_CATEGORIES: { slug: GalleryCategorySlug; label: string }[] = [
  { slug: "havuz", label: "Havuz" },
  { slug: "dis-mekan", label: "Dış Mekan" },
  { slug: "manzara", label: "Manzara" },
  { slug: "salon", label: "Salon" },
  { slug: "odalar", label: "Odalar" },
];

export interface VillaGalleryImage {
  src: string;
  webp: string;
  alt: string;
  categories: GalleryCategorySlug[];
}

export interface VillaGeo {
  lat: number;
  lng: number;
}

export interface VillaAddress {
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
}

export interface VillaContent {
  slug: VillaSlug;
  villa: Villa;
  name: string;
  label: string;
  cover: string;
  coverAlt: string;
  secondary: string;
  secondaryAlt: string;
  gallery: VillaGalleryImage[];
  instagram: string;
  facebook: string;
  description: string;
  quote: string;
  highlights: VillaHighlight[];
  address: VillaAddress;
  geo: VillaGeo;
}

export function formatAddress(address: VillaAddress): string {
  return `${address.streetAddress}, ${address.postalCode} ${address.addressLocality} / ${address.addressRegion}`;
}

// Yalnızca doğrulanmış bilgiler: mevcut yayında olan içerik, D1 (facebook_account_metadata,
// social_accounts) ve işletme sahibinin bildirdiği gerçek fotoğraf envanteri temel alınmıştır.
// Yatak/banyo sayısı, maksimum kapasite, check-in/out saatleri gibi doğrulanmamış özellikler
// eklenmemiştir — bkz. C:\villa-agent-state\remaining.md.
//
// address/geo: kullanıcının paylaştığı Google Maps pin linkleri çözümlenerek elde edildi
// (Destan: maps.app.goo.gl/8zCrgoegzri52ro79, Safira: maps.app.goo.gl/fKBpCQhn5Qneuo5H6),
// posta kodu (07976, Gelemiş Mah., Kaş) bağımsız kaynaklarla (postakodlari.org, cybo.com,
// bölgedeki gerçek bir işletmenin iletişim bilgisi) çapraz doğrulandı. Aynı Maps linkleri
// settings.location_safira/location_destan'a da yazıldı (tek kaynak — bkz. getVillaLocations()).
export const VILLAS: Record<VillaSlug, VillaContent> = {
  "villa-safira": {
    slug: "villa-safira",
    villa: "Safira",
    name: "Villa Safira",
    label: "VILLA 01",
    cover: "/villas/safira-hero-20260830.jpg",
    coverAlt: "Villa Safira Patara Kaş dış görünüm ve özel havuz",
    secondary: "/villas/gallery/safira/safira-havuz-doga.jpg",
    secondaryAlt: "Villa Safira havuzundan Patara vadisine bakan doğa manzarası",
    gallery: [
      { src: "/villas/gallery/safira/safira-havuz-genel-manzara.jpg", webp: "/villas/gallery/safira/safira-havuz-genel-manzara.webp", alt: "Villa Safira özel havuz ve genel dış görünüm", categories: ["havuz", "dis-mekan"] },
      { src: "/villas/gallery/safira/safira-havuz-kusbakisi.jpg", webp: "/villas/gallery/safira/safira-havuz-kusbakisi.webp", alt: "Villa Safira kuşbakışı genel görünüm", categories: ["dis-mekan"] },
      { src: "/villas/gallery/safira/safira-havuz-doga.jpg", webp: "/villas/gallery/safira/safira-havuz-doga.webp", alt: "Villa Safira havuz ve doğa manzarası", categories: ["havuz", "manzara"] },
      { src: "/villas/gallery/safira/safira-havuz-genis-aci.jpg", webp: "/villas/gallery/safira/safira-havuz-genis-aci.webp", alt: "Villa Safira havuz geniş açı görünüm", categories: ["havuz", "manzara"] },
      { src: "/villas/gallery/safira/safira-havuz-panorama.jpg", webp: "/villas/gallery/safira/safira-havuz-panorama.webp", alt: "Villa Safira havuzu ve çam ormanı manzarası", categories: ["havuz", "manzara"] },
      { src: "/villas/gallery/safira/safira-havuz-aktivite.jpg", webp: "/villas/gallery/safira/safira-havuz-aktivite.webp", alt: "Villa Safira havuz başı aktivite", categories: ["havuz"] },
      { src: "/villas/gallery/safira/safira-salon-yemek.jpg", webp: "/villas/gallery/safira/safira-salon-yemek.webp", alt: "Villa Safira salon ve yemek alanı", categories: ["salon"] },
      { src: "/villas/gallery/safira/safira-yatak-odasi.jpg", webp: "/villas/gallery/safira/safira-yatak-odasi.webp", alt: "Villa Safira yatak odası", categories: ["odalar"] },
      { src: "/villas/gallery/safira/safira-jakuzili-oda.jpg", webp: "/villas/gallery/safira/safira-jakuzili-oda.webp", alt: "Villa Safira jakuzili oda", categories: ["odalar"] },
      { src: "/villas/gallery/safira/safira-cocuk-oyun-alani.jpg", webp: "/villas/gallery/safira/safira-cocuk-oyun-alani.webp", alt: "Villa Safira bahçe ve çocuk oyun alanı", categories: ["dis-mekan"] },
      { src: "/villas/gallery/safira/safira-bbq-havuz.jpg", webp: "/villas/gallery/safira/safira-bbq-havuz.webp", alt: "Villa Safira BBQ ve havuz alanı", categories: ["dis-mekan", "havuz"] },
      { src: "/villas/gallery/safira/safira-havuzbasi.jpg", webp: "/villas/gallery/safira/safira-havuzbasi.webp", alt: "Villa Safira havuz başı yaşam alanı", categories: ["havuz"] },
    ],
    instagram: "https://www.instagram.com/villasafirapatara/",
    facebook: "https://www.facebook.com/105073114600720",
    description: "Patara’nın doğal dokusu içinde, özel havuzunuzdan ve bağımsız yaşam alanınızdan vazgeçmeden sakin ve özgür bir Akdeniz tatili.",
    quote: "Günün hiçbir saatinde acele etmeniz gerekmeyen bir yer.",
    address: {
      streetAddress: "Gelemiş Mah. Karaağaçlı Boğaz Sk. Kale Mevkii No:60/9",
      addressLocality: "Kaş",
      addressRegion: "Antalya",
      postalCode: "07976",
      addressCountry: "TR",
    },
    geo: { lat: 36.282113, lng: 29.325177 },
    highlights: [
      { title: "Özel havuz", description: "Villaya özel, doğayla çevrili havuz alanı." },
      { title: "Bahçe ve çocuk oyun alanı", description: "Yeşillik içinde açık hava yaşam alanı ve çocuklar için oyun köşesi." },
      { title: "BBQ alanı", description: "Havuz kenarında açık hava yemek / BBQ imkânı." },
      { title: "Jakuzili oda", description: "Konaklama alanlarından birinde jakuzi bulunur." },
      { title: "Salon ve yemek alanı", description: "Geniş, ferah bir iç mekân yaşam alanı." },
    ],
  },
  "villa-destan": {
    slug: "villa-destan",
    villa: "Destan",
    name: "Villa Destan",
    label: "VILLA 02",
    cover: "/villas/destan-hero-20260830.jpg",
    coverAlt: "Villa Destan Patara Kaş özel havuz ve bahçe görünümü",
    secondary: "/villas/gallery/destan/destan-aksam-havuz.jpg",
    secondaryAlt: "Villa Destan havuzunda akşam atmosferi",
    gallery: [
      { src: "/villas/gallery/destan/destan-drone-genel-gorunum.jpg", webp: "/villas/gallery/destan/destan-drone-genel-gorunum.webp", alt: "Villa Destan kuşbakışı drone görünümü", categories: ["dis-mekan"] },
      { src: "/villas/gallery/destan/destan-aksam-havuz.jpg", webp: "/villas/gallery/destan/destan-aksam-havuz.webp", alt: "Villa Destan akşam dış görünüm ve havuz", categories: ["havuz", "manzara"] },
      { src: "/villas/gallery/destan/destan-gece-havuz.jpg", webp: "/villas/gallery/destan/destan-gece-havuz.webp", alt: "Villa Destan gece havuz ambiyansı", categories: ["havuz", "manzara"] },
      { src: "/villas/gallery/destan/destan-salon-yemek.jpg", webp: "/villas/gallery/destan/destan-salon-yemek.webp", alt: "Villa Destan salon ve yemek alanı", categories: ["salon"] },
      { src: "/villas/gallery/destan/destan-jakuzili-yatak-odasi.jpg", webp: "/villas/gallery/destan/destan-jakuzili-yatak-odasi.webp", alt: "Villa Destan jakuzili yatak odası", categories: ["odalar"] },
      { src: "/villas/gallery/destan/destan-havuzbasi.jpg", webp: "/villas/gallery/destan/destan-havuzbasi.webp", alt: "Villa Destan havuz başı yaşam alanı", categories: ["havuz"] },
      { src: "/villas/gallery/destan/destan-bahce-dinlenme.jpg", webp: "/villas/gallery/destan/destan-bahce-dinlenme.webp", alt: "Villa Destan bahçe ve dinlenme alanı", categories: ["dis-mekan"] },
    ],
    instagram: "https://www.instagram.com/villadestanpatara/",
    facebook: "https://www.facebook.com/1309122082284129",
    description: "Patara, Kaş’ta özel havuzu, geniş yaşam alanları ve güçlü iç mekân detaylarıyla kendi ritminizde, mahremiyet odaklı bir villa tatili.",
    quote: "Dışarı çıkmak istemeyeceğiniz kadar size ait.",
    address: {
      streetAddress: "Gelemiş Mah. Cumhuriyet Cad. No:30",
      addressLocality: "Kaş",
      addressRegion: "Antalya",
      postalCode: "07976",
      addressCountry: "TR",
    },
    geo: { lat: 36.277823, lng: 29.320156 },
    highlights: [
      { title: "Özel havuz", description: "Gündüz ve akşam kullanıma açık özel havuz." },
      { title: "Bahçe", description: "Dinlenme için ayrılmış açık hava alanı." },
      { title: "Jakuzili yatak odası", description: "Konaklama alanlarından birinde jakuzi bulunur." },
      { title: "Salon ve yemek alanı", description: "Geniş iç mekân oturma ve yemek alanı." },
      { title: "Kuşbakışı / drone görünüm", description: "Villanın genel yerleşimi havadan da belgelenmiştir." },
    ],
  },
};

export const FAQ_ITEMS: VillaFaq[] = [
  {
    question: "Rezervasyon nasıl işliyor?",
    answer: "Sitede seçtiğiniz tarihler doğrudan yönetim sistemimizdeki gerçek rezervasyon takvimiyle karşılaştırılır. Müsaitse rezervasyon talebi gönderirsiniz, ekibimiz en kısa sürede sizinle iletişime geçer.",
  },
  {
    question: "Talep gönderince rezervasyon kesinleşmiş olur mu?",
    answer: "Hayır. Web sitesinden gönderilen talep bir ön talep kaydıdır; ekibimiz sizinle iletişime geçip detayları teyit ettikten sonra rezervasyon kesinleşir.",
  },
  {
    question: "Sitede online ödeme alınıyor mu?",
    answer: "Hayır, rezervasyon talebi aşamasında herhangi bir ödeme alınmaz. Ödeme ve depozito detayları ekibimizle doğrudan görüşülür.",
  },
  {
    question: "Fiyata neler dahil?",
    answer: "Gösterilen tutar, seçtiğiniz tarihler için sistemdeki dönemsel gecelik fiyatlardan hesaplanan toplam konaklama bedelidir. Bazı dönemler için fiyat henüz tanımlı değilse bu durum sonuçta belirtilir ve ekibimiz sizinle teyitleşir.",
  },
  {
    question: "İki villa arasındaki fark nedir?",
    answer: "Villa Safira ve Villa Destan, Patara/Kaş bölgesinde ayrı iki özel havuzlu villadır; her birinin kendine özgü yaşam alanı ve karakteri vardır. Detayları ilgili villa sayfasında inceleyebilirsiniz.",
  },
];

export const REGION_INFO = {
  kicker: "PATARA · KAŞ · ANTALYA",
  title: "Patara’da özel havuzlu villa tatili.",
  body: "Villa Safira ve Villa Destan, Antalya’nın Kaş ilçesine bağlı Gelemiş Mahallesi’nde (Patara) yer alır. Patara; uzun kumsalı, antik kenti ve Likya kültürüyle bilinen, Kaş merkezine yakın bir tatil bölgesidir. Bölgeye ulaşım genellikle Dalaman veya Antalya havalimanları üzerinden sağlanır.",
  note: "Rezervasyon talebiniz onaylandığında ulaşım için ek yönlendirme de ekibimizden alabilirsiniz.",
};
