export const LEGAL_PAGE_SLUGS = [
  "hakkimizda",
  "teslimat-iade",
  "gizlilik",
  "kvkk",
  "mesafeli-hizmet-sozlesmesi",
  "on-bilgilendirme",
  "odeme-guvenligi",
] as const;

export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];

export interface LegalPageContent {
  slug: LegalPageSlug;
  title: string;
  navLabel: string;
  description: string;
  paragraphs: string[];
}

export const LEGAL_PAGES: Record<LegalPageSlug, LegalPageContent> = {
  hakkimizda: {
    slug: "hakkimizda",
    title: "Hakkımızda",
    navLabel: "Hakkımızda",
    description: "Safira & Destan Villas, Villa Safira ve Villa Destan doğrudan rezervasyon, konaklama ve iletişim bilgileri.",
    paragraphs: [
      "Safira & Destan Villas, Antalya'nın Kaş ilçesi Patara/Gelemiş bölgesindeki Villa Safira ve Villa Destan için doğrudan rezervasyon, konaklama ve misafir iletişim süreçlerini yürütür.",
      "Amacımız misafirlere villaların gerçek fotoğraflarını, güncel müsaitlik durumunu, dönemsel fiyat bilgisini ve rezervasyon koşullarını açık biçimde sunmaktır. Rezervasyon talebi, ödeme ve konaklama sürecinde bu sitede yayımlanan koşullar ile işlem özelinde misafire gösterilen bilgiler esas alınır.",
      "İletişim ve rezervasyon talepleri safiradestan.com üzerindeki kanallar üzerinden alınır. Resmî iletişim e-posta adresimiz info@safiradestan.com'dur.",
    ],
  },
  "teslimat-iade": {
    slug: "teslimat-iade",
    title: "Teslimat, İptal ve İade Şartları",
    navLabel: "Teslimat, İptal ve İade",
    description: "Villa Safira ve Villa Destan konaklama hizmetinin teslimi, rezervasyon iptali, iade ve cayma hakkı bilgilendirmesi.",
    paragraphs: [
      "Satış konusu fiziksel bir ürün veya kargo teslimatı değildir. Hizmet, rezervasyonda seçilen Villa Safira veya Villa Destan'da, onaylanan giriş ve çıkış tarihleri arasında konaklama hizmetinin sunulmasıyla ifa edilir.",
      "Rezervasyonun kesinleşmesi, ön ödeme, misafir tarafından iptal, no-show, erken ayrılış, işletme tarafından iptal ve iade işlem masrafları Rezervasyon ve Konaklama Koşulları hükümlerine tabidir. İşlem sırasında yazılı olarak ayrıca kararlaştırılan özel bir koşul varsa zorunlu mevzuat saklı kalmak üzere işlem özelindeki kayıt da değerlendirilir.",
      "Belirli bir tarihte veya dönemde sunulacak konaklama hizmetlerinde mevzuattaki cayma hakkı istisnası uygulanabilir. Bu nedenle genel e-ticaret işlemlerindeki 14 gün koşulsuz iade yaklaşımı, tarihli konaklama rezervasyonlarına otomatik olarak uygulanmaz. Yürürlükteki zorunlu tüketici hakları saklıdır.",
    ],
  },
  gizlilik: {
    slug: "gizlilik",
    title: "Gizlilik Politikası",
    navLabel: "Gizlilik Politikası",
    description: "Safira & Destan Villas rezervasyon, iletişim, ödeme ve site güvenliği süreçlerinde kişisel verilerin kullanımına ilişkin gizlilik politikası.",
    paragraphs: [
      "Rezervasyon ve iletişim süreçlerinde ad-soyad, telefon, e-posta, konaklama tarihleri, misafir sayısı, rezervasyon notları, işlem ve ödeme durumu/referansı gibi bilgiler işlenebilir. Site güvenliği ve hata teşhisi için sınırlı teknik kayıtlar da tutulabilir.",
      "Bu bilgiler rezervasyon talebini değerlendirmek, misafirle iletişim kurmak, konaklama hizmetini yerine getirmek, ödeme durumunu eşleştirmek, güvenliği sağlamak ve yasal yükümlülükleri yerine getirmek amacıyla kullanılır. Gerektiğinde ödeme kuruluşları, barındırma/altyapı hizmet sağlayıcıları ve kanunen yetkili mercilerle, amaçla sınırlı şekilde paylaşılabilir.",
      "Kredi veya banka kartı numarası, CVV/CVC güvenlik kodu veya kartın tam son kullanma bilgisi Safira & Destan Villas yönetim sisteminde saklanmaz. Kartlı ödeme etkinleştirildiğinde kart verisi, ilgili lisanslı ödeme kuruluşunun güvenli ödeme akışında işlenir.",
      "Gizlilikle ilgili talepler için info@safiradestan.com adresinden bizimle iletişime geçebilirsiniz.",
    ],
  },
  kvkk: {
    slug: "kvkk",
    title: "KVKK Aydınlatma Metni",
    navLabel: "KVKK Aydınlatma Metni",
    description: "6698 sayılı KVKK kapsamında Safira & Destan Villas rezervasyon ve konaklama süreçlerine ilişkin kişisel veri aydınlatma metni.",
    paragraphs: [
      "6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında Safira & Destan Villas işletmesi; rezervasyon, iletişim ve konaklama süreçlerinde elde edilen kişisel verileri veri sorumlusu sıfatıyla, işleme amacıyla bağlantılı, sınırlı ve ölçülü şekilde işler.",
      "Kişisel veriler; rezervasyon ve hizmet ilişkisinin kurulması ve yürütülmesi, talep ve şikâyetlerin yönetilmesi, ödeme ve muhasebe kayıtlarının eşleştirilmesi, bilgi güvenliği, hukuki yükümlülüklerin yerine getirilmesi ve bir hakkın tesisi, kullanılması veya korunması amaçlarıyla; ilgili hukuki sebebin bulunduğu ölçüde elektronik formlar, telefon, e-posta, mesajlaşma kanalları ve ödeme/altyapı sistemleri üzerinden elde edilebilir.",
      "Veriler, hizmetin yürütülmesi için zorunlu olduğu ölçüde ödeme ve teknik hizmet sağlayıcılarına; hukuki zorunluluk halinde yetkili kamu kurumlarına aktarılabilir. Gereksiz veya süresiz veri saklama amaçlanmaz; kayıtlar işleme amacı ve uygulanabilir yasal saklama süreleriyle sınırlı tutulur.",
      "KVKK'nın 11. maddesi kapsamındaki haklarınız doğrultusunda kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme veya yok etme şartlarının oluşup oluşmadığının değerlendirilmesini isteme ve kanunda yer alan diğer haklarınızı kullanmak için kimliğinizi doğrulayacak bilgilerle info@safiradestan.com adresine başvurabilirsiniz.",
    ],
  },
  "mesafeli-hizmet-sozlesmesi": {
    slug: "mesafeli-hizmet-sozlesmesi",
    title: "Mesafeli Hizmet Sözleşmesi",
    navLabel: "Mesafeli Hizmet Sözleşmesi",
    description: "Villa Safira ve Villa Destan için uzaktan kurulan konaklama hizmeti sözleşmesinin tarafları, konusu, bedeli, ifası ve iptal hükümleri.",
    paragraphs: [
      "Taraflar: Hizmet sağlayıcı Safira & Destan Villas ile rezervasyon sırasında bilgilerini ileten misafir/tüketici arasında, uzaktan iletişim araçları kullanılarak kurulan konaklama hizmeti ilişkisini düzenler.",
      "Sözleşmenin konusu: Rezervasyon ekranında veya yazılı teyitte belirtilen villa, giriş-çıkış tarihleri, gece sayısı, misafir sayısı ve toplam bedel karşılığında konaklama hizmetinin sunulmasıdır. İşlem özelindeki bu bilgiler sözleşmenin ayrılmaz parçasıdır.",
      "Bedel ve ödeme: Toplam fiyat, ön ödeme tutarı, varsa kalan bakiye ve ödeme yöntemi rezervasyon onayından önce misafire gösterilir veya yazılı olarak bildirilir. Rezervasyonun kesinleşmesi için Rezervasyon ve Konaklama Koşulları'ndaki ön ödeme hükmü uygulanır.",
      "Hizmetin ifası: Konaklama, onaylanan tarihlerde ilgili villada gerçekleştirilir. Giriş/çıkış saatleri, hasar güvence bedeli, evcil hayvan ve sigara kuralları Rezervasyon ve Konaklama Koşulları'nda belirtilmiştir.",
      "İptal, iade ve cayma: İptal ve iade hükümleri Rezervasyon ve Konaklama Koşulları'na tabidir. Belirli tarih veya dönemde ifa edilen konaklama hizmetleri için mevzuatta öngörülen cayma hakkı istisnası saklıdır; zorunlu tüketici mevzuatından doğan haklar ortadan kaldırılmaz.",
      "İletişim ve uyuşmazlık: Talep ve şikâyetler info@safiradestan.com üzerinden iletilebilir. Tüketicinin mevzuattan doğan hakem heyeti, mahkeme ve diğer başvuru hakları saklıdır.",
    ],
  },
  "on-bilgilendirme": {
    slug: "on-bilgilendirme",
    title: "Ön Bilgilendirme Formu",
    navLabel: "Ön Bilgilendirme Formu",
    description: "Villa rezervasyonu öncesinde hizmet sağlayıcı, villa, tarihler, toplam fiyat, ödeme ve iptal koşulları hakkında ön bilgilendirme.",
    paragraphs: [
      "Rezervasyonun onaylanmasından ve tüketicinin ödeme yükümlülüğü altına girmesinden önce; hizmet sağlayıcının iletişim bilgileri, seçilen villa, konaklama tarihleri, misafir sayısı, toplam fiyat, ön ödeme/kalan ödeme bilgileri, ödeme yöntemi, giriş-çıkış saatleri ve uygulanabilir iptal/iade koşulları kullanıcıya gösterilir veya kalıcı bir iletişim kanalıyla bildirilir.",
      "Misafir, rezervasyon talebini onaylamadan önce Rezervasyon ve Konaklama Koşulları, Teslimat/İptal/İade Şartları, Mesafeli Hizmet Sözleşmesi ve Gizlilik/KVKK bilgilendirmelerini inceleyebilir. İşlem özelindeki fiyat, tarih, villa ve misafir bilgileri bu genel metinlerin ayrılmaz parçası olarak değerlendirilir.",
      "Ödeme kuruluşunun güvenli ekranına geçilmeden önce kullanıcı, ilgili sözleşme ve ön bilgilendirme metinlerini kabul ettiğini ve gizlilik/KVKK bilgilendirmelerini incelediğini açık kutucuklarla teyit eder.",
    ],
  },
  "odeme-guvenligi": {
    slug: "odeme-guvenligi",
    title: "SSL ve Ödeme Güvenliği",
    navLabel: "SSL ve Ödeme Güvenliği",
    description: "Safira & Destan Villas kartlı ödeme güvenliği, HTTPS/TLS, kart verilerinin saklanmaması ve ödeme kuruluşu bilgilendirmesi.",
    paragraphs: [
      "safiradestan.com ile tarayıcınız arasındaki veri aktarımı HTTPS/TLS kullanılarak korunur. SSL/TLS aktarım güvenliğinin önemli bir katmanıdır; tek başına hiçbir internet işlemi için mutlak güvenlik garantisi anlamına gelmez.",
      "Kart numarası, CVV/CVC güvenlik kodu ve kartın tam son kullanma bilgisi Safira & Destan Villas uygulamasında veya yönetim sisteminde saklanmaz.",
      "Kartlı ödeme özelliği etkinleştirildiğinde kart bilgileri, hesabı ve entegrasyonu aktif olan ilgili lisanslı ödeme kuruluşunun güvenli ödeme akışında işlenir. Bir ödeme kuruluşu yalnız entegrasyon gerçekten hazır ve aktif olduğunda ödeme seçeneği olarak sunulur.",
      "Şüpheli veya yetkisiz bir kart işlemi fark edilmesi halinde kartı veren banka ve ilgili ödeme kuruluşuyla gecikmeden iletişime geçilmesi önerilir.",
    ],
  },
};

export const LEGAL_PAGE_LINKS = LEGAL_PAGE_SLUGS.map((slug) => ({
  href: `/${slug}`,
  label: LEGAL_PAGES[slug].navLabel,
}));
