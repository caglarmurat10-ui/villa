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

export type GalleryCategorySlug =
  | "dis-mekan"
  | "havuz"
  | "yatak-odalari"
  | "salon-ortak"
  | "mutfak"
  | "banyolar"
  | "bahce-yasam"
  | "ozel-detaylar"
  | "manzara-drone";

export const GALLERY_CATEGORIES: { slug: GalleryCategorySlug; label: string }[] = [
  { slug: "havuz", label: "Havuz" },
  { slug: "dis-mekan", label: "Dış Mekan" },
  { slug: "yatak-odalari", label: "Yatak Odaları" },
  { slug: "salon-ortak", label: "Salon & Ortak Alanlar" },
  { slug: "mutfak", label: "Mutfak" },
  { slug: "banyolar", label: "Banyolar" },
  { slug: "bahce-yasam", label: "Bahçe & Yaşam" },
  { slug: "ozel-detaylar", label: "Özel Detaylar" },
  { slug: "manzara-drone", label: "Manzara & Drone" },
];

export interface VillaGalleryImage {
  src: string;
  webp: string;
  alt: string;
  categories: GalleryCategorySlug[];
  width: number;
  height: number;
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

export interface VillaQuickFacts {
  bedroomCount: number;
  chips: string[];
  summary: string;
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
  quickFacts: VillaQuickFacts;
  address: VillaAddress;
  geo: VillaGeo;
}

export function formatAddress(address: VillaAddress): string {
  return `${address.streetAddress}, ${address.postalCode} ${address.addressLocality} / ${address.addressRegion}`;
}

// Yalnızca doğrulanmış bilgiler: mevcut yayında olan içerik, D1 (facebook_account_metadata,
// social_accounts) ve işletme sahibinin bildirdiği gerçek fotoğraf envanteri temel alınmıştır.
//
// quickFacts (oda/banyo yapısı): işletme sahibi tarafından 2026-09-01'de birebir doğrulandı.
// Safira: 2 yatak odası, ikisinde de özel banyo+WC+jakuzi, ayrıca 1 ortak WC, 1 salon, 1 mutfak,
// 1 çamaşır odası. Destan: 3 yatak odası — 2'sinde özel banyo+WC+jakuzi, 1'i iki tek kişilik
// yataklı ve ortak banyo/WC kullanıyor; ayrıca 1 oturma odası, 1 mutfak. Maksimum misafir
// kapasitesi ve Destan'ın diğer 2 odasının yatak tipi HENÜZ DOĞRULANMADI — uydurulmadı.
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
      { src: "/villas/gallery/safira/safira-havuz-genel-manzara.jpg", webp: "/villas/gallery/safira/safira-havuz-genel-manzara.webp", alt: "Villa Safira özel havuz ve genel dış görünüm", categories: ["havuz", "manzara-drone"], width: 1800, height: 949 },
      { src: "/villas/gallery/safira/safira-havuz-kusbakisi.jpg", webp: "/villas/gallery/safira/safira-havuz-kusbakisi.webp", alt: "Villa Safira kuşbakışı genel görünüm", categories: ["dis-mekan", "manzara-drone"], width: 1800, height: 1348 },
      { src: "/villas/gallery/safira/safira-havuz-doga.jpg", webp: "/villas/gallery/safira/safira-havuz-doga.webp", alt: "Villa Safira havuz ve doğa manzarası", categories: ["havuz", "manzara-drone"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-havuz-genis-aci.jpg", webp: "/villas/gallery/safira/safira-havuz-genis-aci.webp", alt: "Villa Safira havuz geniş açı görünüm", categories: ["havuz", "manzara-drone"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-havuz-panorama.jpg", webp: "/villas/gallery/safira/safira-havuz-panorama.webp", alt: "Villa Safira havuzu ve çam ormanı manzarası", categories: ["havuz", "manzara-drone"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-havuz-aktivite.jpg", webp: "/villas/gallery/safira/safira-havuz-aktivite.webp", alt: "Villa Safira havuz başı foseball ve BBQ aktivite alanı", categories: ["ozel-detaylar", "havuz"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-salon-yemek.jpg", webp: "/villas/gallery/safira/safira-salon-yemek.webp", alt: "Villa Safira salon ve yemek alanı", categories: ["salon-ortak"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-yatak-odasi.jpg", webp: "/villas/gallery/safira/safira-yatak-odasi.webp", alt: "Villa Safira 1. yatak odası — özel banyo, WC ve jakuzi", categories: ["yatak-odalari", "ozel-detaylar"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-jakuzili-oda.jpg", webp: "/villas/gallery/safira/safira-jakuzili-oda.webp", alt: "Villa Safira 2. yatak odası — özel banyo, WC ve jakuzi", categories: ["yatak-odalari", "ozel-detaylar"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-yatak-odasi-2.jpg", webp: "/villas/gallery/safira/safira-yatak-odasi-2.webp", alt: "Villa Safira'da bir jakuzi köşesi detayı", categories: ["ozel-detaylar"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-mutfak.jpg", webp: "/villas/gallery/safira/safira-mutfak.webp", alt: "Villa Safira mutfak ve yemek alanı", categories: ["mutfak"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-banyo.jpg", webp: "/villas/gallery/safira/safira-banyo.webp", alt: "Villa Safira ortak kullanım WC", categories: ["banyolar"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-cocuk-oyun-alani.jpg", webp: "/villas/gallery/safira/safira-cocuk-oyun-alani.webp", alt: "Villa Safira bahçe ve çocuk oyun alanı", categories: ["bahce-yasam", "ozel-detaylar"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-bbq-havuz.jpg", webp: "/villas/gallery/safira/safira-bbq-havuz.webp", alt: "Villa Safira BBQ ve havuz alanı", categories: ["ozel-detaylar", "havuz"], width: 1800, height: 1200 },
      { src: "/villas/gallery/safira/safira-havuzbasi.jpg", webp: "/villas/gallery/safira/safira-havuzbasi.webp", alt: "Villa Safira havuz başı yaşam alanı", categories: ["bahce-yasam", "havuz"], width: 1800, height: 1200 },
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
      { title: "2 jakuzili yatak odası", description: "İki yatak odasının her birinde özel banyo, WC ve jakuzi bulunur." },
      { title: "Donanımlı mutfak", description: "Ankastre ocak, fırın ve bulaşık makinesiyle tam donanımlı mutfak." },
      { title: "Salon ve çamaşır odası", description: "Geniş bir salonun yanı sıra ayrı bir çamaşır odası bulunur." },
    ],
    quickFacts: {
      bedroomCount: 2,
      chips: ["2 Yatak Odası", "2 Jakuzili Oda", "2 Özel Banyo/WC", "Ortak WC", "Salon", "Mutfak", "Çamaşır Odası"],
      summary: "İki yatak odasının her birinde özel banyo, WC ve jakuzi bulunur; ayrıca ortak kullanım için bir WC vardır.",
    },
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
      { src: "/villas/gallery/destan/destan-drone-genel-gorunum.jpg", webp: "/villas/gallery/destan/destan-drone-genel-gorunum.webp", alt: "Villa Destan kuşbakışı drone görünümü", categories: ["dis-mekan", "manzara-drone"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-aksam-havuz.jpg", webp: "/villas/gallery/destan/destan-aksam-havuz.webp", alt: "Villa Destan akşam dış görünüm ve havuz", categories: ["havuz", "manzara-drone", "bahce-yasam"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-gece-havuz.jpg", webp: "/villas/gallery/destan/destan-gece-havuz.webp", alt: "Villa Destan gece havuz ambiyansı", categories: ["havuz", "ozel-detaylar"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-salon-yemek.jpg", webp: "/villas/gallery/destan/destan-salon-yemek.webp", alt: "Villa Destan salon ve yemek alanı", categories: ["salon-ortak"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-yatak-odasi-2.jpg", webp: "/villas/gallery/destan/destan-yatak-odasi-2.webp", alt: "Villa Destan 1. yatak odası — iki tek kişilik yatak", categories: ["yatak-odalari"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-jakuzili-yatak-odasi.jpg", webp: "/villas/gallery/destan/destan-jakuzili-yatak-odasi.webp", alt: "Villa Destan 2. yatak odası — özel banyo, WC ve jakuzi", categories: ["yatak-odalari", "ozel-detaylar"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-yatak-odasi-3.jpg", webp: "/villas/gallery/destan/destan-yatak-odasi-3.webp", alt: "Villa Destan 3. yatak odası — özel banyo, WC ve jakuzi", categories: ["yatak-odalari", "ozel-detaylar"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-jakuzi-detay.jpg", webp: "/villas/gallery/destan/destan-jakuzi-detay.webp", alt: "Villa Destan'da bir jakuzi köşesi detayı", categories: ["ozel-detaylar"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-mutfak.jpg", webp: "/villas/gallery/destan/destan-mutfak.webp", alt: "Villa Destan mutfak ve yemek alanı", categories: ["mutfak"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-banyo.jpg", webp: "/villas/gallery/destan/destan-banyo.webp", alt: "Villa Destan ortak kullanım banyo ve WC", categories: ["banyolar"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-cocuk-oyun-alani.jpg", webp: "/villas/gallery/destan/destan-cocuk-oyun-alani.webp", alt: "Villa Destan bahçede çocuk oyun alanı", categories: ["bahce-yasam", "ozel-detaylar"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-havuzbasi.jpg", webp: "/villas/gallery/destan/destan-havuzbasi.webp", alt: "Villa Destan havuz başı yaşam alanı", categories: ["havuz", "bahce-yasam"], width: 1800, height: 1200 },
      { src: "/villas/gallery/destan/destan-bahce-dinlenme.jpg", webp: "/villas/gallery/destan/destan-bahce-dinlenme.webp", alt: "Villa Destan bahçe ve dinlenme alanı", categories: ["bahce-yasam"], width: 1800, height: 1200 },
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
      { title: "Bahçe ve çocuk oyun alanı", description: "Dinlenme için ayrılmış açık hava alanı ve çocuklar için oyun köşesi." },
      { title: "2 jakuzili yatak odası", description: "Üç yatak odasından ikisinde özel banyo, WC ve jakuzi bulunur." },
      { title: "İkiz yataklı oda", description: "Diğer yatak odasında iki tek kişilik yatak vardır; ortak banyo ve WC kullanılır." },
      { title: "Donanımlı mutfak", description: "Ankastre ocak, fırın ve bulaşık makinesiyle tam donanımlı mutfak." },
      { title: "Kuşbakışı / drone görünüm", description: "Villanın genel yerleşimi havadan da belgelenmiştir." },
    ],
    quickFacts: {
      bedroomCount: 3,
      chips: ["3 Yatak Odası", "2 Jakuzili Oda", "2 Özel Banyo/WC", "1 Ortak Banyo/WC", "2 Tek Kişilik Yatak Bulunan Oda", "Oturma Odası", "Mutfak"],
      summary: "Üç yatak odasından ikisinde özel banyo, WC ve jakuzi bulunur. Diğer yatak odasında iki tek kişilik yatak vardır ve ortak banyo/WC'ye erişim sağlanır.",
    },
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
