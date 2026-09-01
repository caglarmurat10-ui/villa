// /rehber alt sayfaları - GUIDE_PLACES'teki (region-guide.ts) ZATEN doğrulanmış verinin üzerine
// inşa edilir, yeni bir sayısal iddia (mesafe/süre/ücret/saat) EKLEMEZ. Her sayfa özgün bir açıdan
// yazılmıştır (thin/doorway sayfa değil) - Patara'nın kendisi, plajı, antik kenti; Kaş; Kalkan ayrı
// ayrı ele alınır, aynı paragrafın şehir adı değiştirilmiş kopyası değildir.

export type RegionGuidePageSlug = "patara" | "patara-plaji" | "patara-antik-kenti" | "kas" | "kalkan";

export interface RegionGuidePageFaq {
  question: string;
  answer: string;
}

export interface RegionGuidePage {
  slug: RegionGuidePageSlug;
  title: string;
  metaDescription: string;
  kicker: string;
  intro: string;
  sections: { heading: string; body: string }[];
  relatedPlaceIds: string[];
  faq: RegionGuidePageFaq[];
}

export const REGION_GUIDE_PAGES: Record<RegionGuidePageSlug, RegionGuidePage> = {
  patara: {
    slug: "patara",
    title: "Patara Rehberi — Antik Kent, Plaj ve Doğa",
    metaDescription: "Patara'da görülecek yerler: Patara Antik Kenti, Patara Plajı, kum tepeleri ve deniz feneri. Villa Safira ve Villa Destan'a yakın bölge rehberi.",
    kicker: "PATARA REHBERİ",
    intro: "Patara, Likya uygarlığının izlerini taşıyan bir antik kentle Akdeniz'in en uzun kumsallarından birini aynı koyda bir araya getiren nadir bir bölge. Villa Safira ve Villa Destan, bu bölgede, hem tarihe hem denize kolay erişimin mümkün olduğu bir konumda yer alıyor.",
    sections: [
      {
        heading: "Patara Antik Kenti",
        body: "Likya Birliği'nin yönetim merkezi olan Patara Antik Kenti, kalıntıları MÖ 8. yüzyıla kadar uzanan geniş bir ören yeri. Bouleuterion (Meclis Binası) ve Roma İmparatoru Nero döneminde inşa edilmiş deniz feneri, bölgenin en bilinen yapıları arasında. Patara Plajı'na giriş de bu ören yeri üzerinden yapılıyor.",
      },
      {
        heading: "Patara Plajı",
        body: "İnce kumlu, uzun bir sahil şeridi olan Patara Plajı, Caretta caretta deniz kaplumbağalarının yuvalama alanlarından biri olduğu için koruma altında. Sahil boyunca uzanan doğal kum tepeleri, rüzgârın şekillendirdiği bir peyzaj oluşturuyor.",
      },
      {
        heading: "Villadan Patara'ya",
        body: "Villa Safira ve Villa Destan, Gelemiş Mahallesi'nde, Patara'nın hemen yakınında konumlanıyor. Güncel yol/mesafe bilgisi için haritadaki konum işaretlerimizi kullanabilir, tatilinizi planlarken bölgenin güncel koşullarını kontrol edebilirsiniz.",
      },
    ],
    relatedPlaceIds: ["patara-antik-kenti", "patara-plaji", "patara-kum-tepeleri", "patara-deniz-feneri", "patara-meclis-binasi"],
    faq: [
      { question: "Patara Plajı'na nasıl gidilir?", answer: "Patara Plajı'na giriş, Patara Antik Kenti ören yeri üzerinden yapılır." },
      { question: "Patara'da villa tatili için Villa Safira ve Villa Destan'ın konumu nasıl?", answer: "Her iki villa da Gelemiş Mahallesi'nde, Patara bölgesine yakın konumdadır. Kesin adres ve harita konumu için villa sayfalarımızdaki Google Maps bağlantısını kullanabilirsiniz." },
    ],
  },
  "patara-plaji": {
    slug: "patara-plaji",
    title: "Patara Plajı — Kum Tepeleri ve Koruma Alanı",
    metaDescription: "Patara Plajı hakkında: uzunluğu, Caretta caretta koruma alanı, doğal kum tepeleri ve girişin Patara Antik Kenti üzerinden yapılması.",
    kicker: "PATARA PLAJI",
    intro: "Patara Plajı, Akdeniz'in en uzun kumsallarından biri olarak bilinir ve aynı zamanda doğa koruma alanı statüsündedir. İnce kumu, geniş sahil şeridi ve arkasındaki doğal kum tepeleriyle bölgenin en belirgin doğal miraslarından biridir.",
    sections: [
      {
        heading: "Doğa koruma alanı",
        body: "Plaj, Caretta caretta (iribaş deniz kaplumbağası) türünün yuvalama alanlarından biri olduğu için koruma altındadır. Bu nedenle sahilde bazı dönemlerde ve bölgelerde erişim/davranış kısıtlamaları uygulanabilir; güncel kuralları ziyaret öncesinde yerinde kontrol etmek en doğrusudur.",
      },
      {
        heading: "Kum tepeleri",
        body: "Sahil şeridi boyunca uzanan doğal kum tepeleri, rüzgârın sürekli şekillendirdiği bir peyzaj oluşturur. Bazı noktalarda oldukça yüksek tepeler görülebilir; bu da Patara'yı bölgedeki diğer plajlardan görsel olarak ayıran bir özelliktir.",
      },
      {
        heading: "Girişi ve konumu",
        body: "Patara Plajı'na giriş, Patara Antik Kenti ören yeri üzerinden yapılır — yani plaja gitmeden önce antik kentin bir bölümünden geçilir. Bu da tek bir ziyarette hem tarihi hem doğal güzelliği görme imkânı sunar.",
      },
    ],
    relatedPlaceIds: ["patara-plaji", "patara-kum-tepeleri", "patara-antik-kenti"],
    faq: [
      { question: "Patara Plajı neden koruma altında?", answer: "Caretta caretta deniz kaplumbağalarının yuvalama alanlarından biri olduğu için koruma altındadır." },
      { question: "Patara Plajı'na girmek için antik kentten mi geçmek gerekiyor?", answer: "Evet, plaja giriş Patara Antik Kenti ören yeri üzerinden yapılır." },
    ],
  },
  "patara-antik-kenti": {
    slug: "patara-antik-kenti",
    title: "Patara Antik Kenti — Likya Birliği'nin Merkezi",
    metaDescription: "Patara Antik Kenti: Likya Birliği'nin yönetim merkezi, Bouleuterion (Meclis Binası) ve Roma dönemi deniz feneri hakkında bilgiler.",
    kicker: "PATARA ANTİK KENTİ",
    intro: "Patara Antik Kenti, Likya Birliği'nin yönetim merkezi olarak tarih sahnesinde önemli bir yere sahip. Kalıntıları MÖ 8. yüzyıla kadar uzanan geniş bir ören yeri, bugün hem tarih meraklıları hem de Patara Plajı'na gidenler için bir geçiş noktası.",
    sections: [
      {
        heading: "Likya Birliği'nin merkezi",
        body: "Patara, antik dönemde Likya Birliği'nin yönetim merkezi olarak hizmet gördü. Bölgedeki kalıntılar bu tarihi önemi yansıtır ve MÖ 8. yüzyıla kadar uzanan bir geçmişe sahiptir.",
      },
      {
        heading: "Bouleuterion (Meclis Binası)",
        body: "Likya Birliği'nin toplantı yeri olarak inşa edilen Meclis Binası, yaklaşık 1400 kişilik oturma kapasitesiyle antik dönemin önemli yönetim yapılarından biriydi.",
      },
      {
        heading: "Deniz Feneri",
        body: "Roma İmparatoru Nero döneminde MS 64/65'te inşa edilen Patara Deniz Feneri, dünyanın ayakta kalan en eski deniz fenerlerinden biri olarak kabul edilir.",
      },
      {
        heading: "Plaja komşuluk",
        body: "Patara Antik Kenti'nin bir diğer özelliği, Patara Plajı'na girişin bu ören yeri üzerinden yapılmasıdır — tarihi ve doğal güzelliği aynı ziyarette birleştirir.",
      },
    ],
    relatedPlaceIds: ["patara-antik-kenti", "patara-meclis-binasi", "patara-deniz-feneri", "patara-plaji"],
    faq: [
      { question: "Patara Antik Kenti neden önemli?", answer: "Likya Birliği'nin yönetim merkezi olması ve kalıntılarının MÖ 8. yüzyıla kadar uzanmasıyla bölgenin en önemli tarihi alanlarından biridir." },
      { question: "Patara Deniz Feneri ne zaman inşa edildi?", answer: "Roma İmparatoru Nero döneminde, MS 64/65 yıllarında inşa edilmiştir." },
    ],
  },
  kas: {
    slug: "kas",
    title: "Kaş Gezi Rehberi — Merkez ve Kaputaş Plajı",
    metaDescription: "Kaş'ta görülecek yerler: tarihi liman, Likya lahitleri, antik tiyatro ve yakınındaki Kaputaş Plajı. Villa Safira ve Villa Destan'a yakın bölge rehberi.",
    kicker: "KAŞ REHBERİ",
    intro: "Kaş, tarihi limanı ve Likya dönemine ait kalıntılarıyla bilinen bir Akdeniz sahil kasabası. Villa Safira ve Villa Destan'ın bulunduğu Patara/Gelemiş bölgesine yakınlığıyla, tatilinizde gezi rotanıza dahil edebileceğiniz bir durak.",
    sections: [
      {
        heading: "Kaş Merkez",
        body: "Kaş'ın merkezi, tarihi limanı, Likya lahitleri ve antik tiyatrosuyla tanınır. Kafe ve restoranlarla çevrili meydanı, kasabanın günlük yaşamının kalbi konumundadır.",
      },
      {
        heading: "Kaputaş Plajı",
        body: "Kaş ile Kalkan arasında yer alan Kaputaş Plajı, karayolundan merdivenlerle inilen bir kanyon ağzı plajıdır. Turkuaz ve berrak suyuyla bölgenin en bilinen plajlarından biridir.",
      },
      {
        heading: "Villadan Kaş'a",
        body: "Villa Safira ve Villa Destan, Patara/Gelemiş bölgesinde yer alır; Kaş bu bölgenin gezi güzergâhında yer alan bir diğer duraktır. Güncel yol koşulları ve süre bilgisi için harita uygulamanızı kullanmanızı öneririz.",
      },
    ],
    relatedPlaceIds: ["kas-merkez", "kaputas-plaji"],
    faq: [
      { question: "Kaputaş Plajı'na nasıl inilir?", answer: "Kaputaş Plajı'na karayolundan merdivenlerle inilir." },
      { question: "Kaş merkezde neler görülebilir?", answer: "Tarihi liman, Likya lahitleri, antik tiyatro ve kafe/restoranlarla çevrili meydan Kaş merkezin öne çıkan noktalarıdır." },
    ],
  },
  kalkan: {
    slug: "kalkan",
    title: "Kalkan Gezi Rehberi — Şık Bir Sahil Kasabası",
    metaDescription: "Kalkan hakkında: eski Rum balıkçı köyü geçmişi, beyaz badanalı evleri ve marinası. Villa Safira ve Villa Destan'a yakın bölge rehberi.",
    kicker: "KALKAN REHBERİ",
    intro: "Kalkan, eski bir Rum balıkçı köyünden gelişerek bugünkü şık sahil kasabası halini almış bir yerleşim. Beyaz badanalı evleri ve marinasıyla, Patara/Gelemiş bölgesinde tatil yapan ziyaretçilerin gezi rotasına dahil edebileceği bir diğer durak.",
    sections: [
      {
        heading: "Tarihi doku",
        body: "Kalkan, eski bir Rum balıkçı köyünden gelişen geçmişiyle bilinir. Bu tarihi doku, kasabanın mimarisinde ve dar sokaklarında hâlâ hissedilir.",
      },
      {
        heading: "Marina ve sahil",
        body: "Beyaz badanalı evleri ve marinasıyla Kalkan, bölgenin daha şık ve sakin sahil kasabalarından biri olarak öne çıkar.",
      },
      {
        heading: "Villadan Kalkan'a",
        body: "Villa Safira ve Villa Destan'ın bulunduğu Patara/Gelemiş bölgesinden Kalkan'a ulaşım mümkündür. Güncel yol koşulları ve süre bilgisi için harita uygulamanızı kullanmanızı öneririz.",
      },
    ],
    relatedPlaceIds: ["kalkan"],
    faq: [
      { question: "Kalkan'ın tarihi geçmişi nedir?", answer: "Kalkan, eski bir Rum balıkçı köyünden gelişerek bugünkü şık sahil kasabası halini almıştır." },
    ],
  },
};

export const REGION_GUIDE_PAGE_SLUGS = Object.keys(REGION_GUIDE_PAGES) as RegionGuidePageSlug[];
