// Patara & Kaş Bölge Rehberi — tek canonical kaynak.
// Tüm bilgiler 2026-09-01'de bağımsız, çok kaynaklı web araştırmasıyla doğrulandı
// (Vikipedi, resmi/turizm rehberi siteleri, çapraz kontrol edildi).
// Villadan bu yerlere kesin mesafe/sürüş süresi YOK — doğrulanmış rota verisi
// (Directions API erişimi) olmadan uydurulmadı, bilerek eklenmedi.

export type GuideCategorySlug = "tarih" | "deniz" | "doga" | "gezi";

export interface GuideCategory {
  slug: GuideCategorySlug;
  label: string;
}

export const GUIDE_CATEGORIES: GuideCategory[] = [
  { slug: "tarih", label: "Tarih" },
  { slug: "deniz", label: "Deniz" },
  { slug: "doga", label: "Doğa" },
  { slug: "gezi", label: "Gezi" },
];

export interface GuidePlace {
  id: string;
  name: string;
  category: GuideCategorySlug;
  description: string;
  mapsQuery: string;
}

export const GUIDE_PLACES: GuidePlace[] = [
  {
    id: "patara-antik-kenti",
    name: "Patara Antik Kenti",
    category: "tarih",
    description: "Likya Birliği'nin yönetim merkezi olan antik kent; kalıntıları MÖ 8. yüzyıla kadar uzanır. Patara Plajı'na giriş bu ören yeri üzerinden yapılır.",
    mapsQuery: "Patara Antik Kenti, Kaş, Antalya",
  },
  {
    id: "patara-plaji",
    name: "Patara Plajı",
    category: "deniz",
    description: "Yaklaşık 18 km uzunluğunda, ince kumlu bir sahil. Caretta caretta deniz kaplumbağalarının yuvalama alanlarından biri olduğu için koruma altındadır.",
    mapsQuery: "Patara Plajı, Kaş, Antalya",
  },
  {
    id: "patara-kum-tepeleri",
    name: "Patara Kum Tepeleri",
    category: "doga",
    description: "Rüzgârın sürekli şekillendirdiği, bazı noktalarda 30 metreyi aşan doğal kum tepeleri; Patara Plajı'nın sahil şeridi boyunca uzanır.",
    mapsQuery: "Patara Kum Tepeleri, Kaş, Antalya",
  },
  {
    id: "patara-deniz-feneri",
    name: "Patara Deniz Feneri",
    category: "tarih",
    description: "Roma İmparatoru Nero döneminde MS 64/65'te inşa edilmiş, dünyanın ayakta kalan en eski deniz fenerlerinden biri.",
    mapsQuery: "Patara Deniz Feneri, Kaş, Antalya",
  },
  {
    id: "patara-meclis-binasi",
    name: "Patara Meclis Binası",
    category: "tarih",
    description: "Likya Birliği'nin toplantı yeri olarak inşa edilen, yaklaşık 1400 kişilik oturma kapasiteli antik meclis binası (Bouleuterion).",
    mapsQuery: "Patara Bouleuterion Meclis Binası, Kaş, Antalya",
  },
  {
    id: "kaputas-plaji",
    name: "Kaputaş Plajı",
    category: "deniz",
    description: "Kaş ile Kalkan arasında, karayolundan merdivenlerle inilen, turkuaz ve berrak suyuyla bilinen bir kanyon ağzı plajı.",
    mapsQuery: "Kaputaş Plajı, Kaş, Antalya",
  },
  {
    id: "xanthos-antik-kenti",
    name: "Xanthos Antik Kenti",
    category: "tarih",
    description: "Eski Likya'nın başkenti; Letoon ile birlikte 1988'de UNESCO Dünya Mirası Listesi'ne girmiştir. Kaya mezarları ve anıt mezarlarıyla bilinir.",
    mapsQuery: "Xanthos Antik Kenti, Kınık, Antalya",
  },
  {
    id: "saklikent-kanyonu",
    name: "Saklıkent Kanyonu",
    category: "doga",
    description: "16 km uzunluğunda, duvarları 200-600 metre yüksekliğe ulaşan, serin sularıyla bilinen bir kanyon.",
    mapsQuery: "Saklıkent Kanyonu, Fethiye, Muğla",
  },
  {
    id: "kas-merkez",
    name: "Kaş Merkez",
    category: "gezi",
    description: "Tarihi limanı, Likya lahitleri ve antik tiyatrosuyla bilinen sahil kasabası; kafe ve restoranlarla çevrili bir meydanı vardır.",
    mapsQuery: "Kaş Limanı, Antalya",
  },
  {
    id: "kalkan",
    name: "Kalkan",
    category: "gezi",
    description: "Eski bir Rum balıkçı köyünden gelişen, beyaz badanalı evleri ve marinasıyla bilinen şık bir sahil kasabası.",
    mapsQuery: "Kalkan, Antalya",
  },
  {
    id: "letoon-antik-kenti",
    name: "Letoon Antik Kenti",
    category: "tarih",
    description: "Likya Birliği'nin dinî merkezi olan antik kutsal alan; Apollon, Artemis ve Leto'ya adanmış üç tapınağıyla bilinir. Xanthos ile birlikte 1988'de UNESCO Dünya Mirası Listesi'ne girmiştir.",
    mapsQuery: "Letoon Antik Kenti, Kumluova, Muğla",
  },
  {
    id: "likya-yolu",
    name: "Likya Yolu",
    category: "doga",
    description: "Antalya'dan Fethiye'ye uzanan, dünyanın önde gelen uzun mesafe yürüyüş rotalarından biri olarak bilinen Likya Yolu'nun bir bölümü Patara, Kalkan ve Kaş üzerinden geçer; kıyı ve antik kent manzaralarını bir arada sunar.",
    mapsQuery: "Lykian Way, Kaş, Antalya",
  },
];

export function guideMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}
