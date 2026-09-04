import type { Metadata } from "next";
import Link from "next/link";
import { VILLAS } from "@/lib/villa-content";
import { POLICY_SECTIONS, POLICY_SUMMARY } from "@/lib/reservation-policy";
import { WHATSAPP_PHONE_DISPLAY_TR } from "@/lib/contact";
import CookiePreferencesButton from "@/components/analytics/CookiePreferencesButton";
import styles from "../site.module.css";

const ORIGIN = "https://safiradestan.com";
const CANONICAL = `${ORIGIN}/rezervasyon-kosullari`;

const TITLE = "Rezervasyon ve Konaklama Koşulları | Safira & Destan Villas";
const DESCRIPTION = "Villa Safira ve Villa Destan için rezervasyon ön ödemesi, iptal ve iade, hasar güvence bedeli, giriş/çıkış, gizlilik, KVKK, mesafeli hizmet ve ödeme güvenliği bilgileri.";

const LEGAL_LINKS = [
  { href: "#hakkimizda", label: "Hakkımızda" },
  { href: "#teslimat-iade", label: "Teslimat ve İade" },
  { href: "#gizlilik", label: "Gizlilik" },
  { href: "#kvkk", label: "KVKK" },
  { href: "#mesafeli-hizmet-sozlesmesi", label: "Mesafeli Hizmet Sözleşmesi" },
  { href: "#on-bilgilendirme", label: "Ön Bilgilendirme" },
  { href: "#odeme-guvenligi", label: "Ödeme Güvenliği" },
] as const;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ReservationPolicyPage() {
  const safira = VILLAS["villa-safira"];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana sayfa", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: "Rezervasyon ve Konaklama Koşulları", item: CANONICAL },
        ],
      },
      {
        "@type": "WebPage",
        "@id": `${CANONICAL}/#webpage`,
        url: CANONICAL,
        name: TITLE,
        description: DESCRIPTION,
        isPartOf: { "@type": "WebSite", "@id": `${ORIGIN}/#website` },
      },
    ],
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <a href="#policy-icerik" className={styles.skipLink}>İçeriğe atla</a>
      <section className={styles.policyHead}>
        <nav className={styles.nav} aria-label="Ana menü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}>
            <Link href="/">Ana sayfa</Link>
            <Link href="/villa-safira">Villa Safira</Link>
            <Link href="/villa-destan">Villa Destan</Link>
          </div>
        </nav>
        <div className={styles.policyHeadCopy} id="policy-icerik" tabIndex={-1}>
          <span className={styles.eyebrow}>SAFIRA &amp; DESTAN VILLAS</span>
          <h1 className={styles.policyTitle}>Rezervasyon ve Konaklama Koşulları</h1>
          <p className={styles.lead}>Villa Safira ve Villa Destan rezervasyonları için ön ödeme, iptal, hasar güvence bedeli ve konaklama kurallarının yanı sıra ödeme kuruluşlarının talep ettiği yasal ve güvenlik bilgilendirmeleri bu sayfada yer alır.</p>
        </div>
      </section>

      <section className={styles.policySummary} aria-label="Yasal ve ödeme bilgileri menüsü">
        <div className={styles.factChips}>
          {LEGAL_LINKS.map((item) => (
            <a className={styles.factChip} href={item.href} key={item.href}>{item.label}</a>
          ))}
        </div>
      </section>

      <section className={styles.policyBody}>
        <article className={styles.policySection} id="hakkimizda">
          <h2>Hakkımızda</h2>
          <p>Safira &amp; Destan Villas, Antalya’nın Kaş ilçesi Patara/Gelemiş bölgesindeki Villa Safira ve Villa Destan için doğrudan rezervasyon, konaklama ve misafir iletişim süreçlerini yürütür.</p>
          <p>Amacımız misafirlere villaların gerçek fotoğraflarını, güncel müsaitlik durumunu, dönemsel fiyat bilgisini ve rezervasyon koşullarını açık biçimde sunmaktır. Rezervasyon talebi, ödeme ve konaklama sürecinde bu sitede yayımlanan koşullar ile işlem özelinde misafire gösterilen bilgiler esas alınır.</p>
          <p>İletişim: <a href="mailto:info@safiradestan.com">info@safiradestan.com</a> · {WHATSAPP_PHONE_DISPLAY_TR} · {safira.address.addressLocality}, {safira.address.addressRegion}</p>
        </article>

        <article className={styles.policySection} id="teslimat-iade">
          <h2>Teslimat, İptal ve İade Şartları</h2>
          <p>Satış konusu fiziksel bir ürün veya kargo teslimatı değildir. Hizmet, rezervasyonda seçilen Villa Safira veya Villa Destan’da, onaylanan giriş ve çıkış tarihleri arasında konaklama hizmetinin sunulmasıyla ifa edilir.</p>
          <p>Rezervasyonun kesinleşmesi, ön ödeme, misafir tarafından iptal, no-show, erken ayrılış, işletme tarafından iptal ve iade işlem masrafları aşağıdaki “Rezervasyon ve Konaklama Koşulları” hükümlerine tabidir. İşlem sırasında yazılı olarak ayrıca kararlaştırılan özel bir koşul varsa zorunlu mevzuat saklı kalmak üzere işlem özelindeki kayıt da değerlendirilir.</p>
          <p>Belirli bir tarihte veya dönemde sunulacak konaklama hizmetlerinde mevzuattaki cayma hakkı istisnası uygulanabilir. Bu nedenle genel e-ticaret işlemlerindeki “14 gün koşulsuz iade” kuralı, tarihli konaklama rezervasyonlarına otomatik olarak uygulanmaz. Yürürlükteki zorunlu tüketici hakları saklıdır.</p>
        </article>

        <article className={styles.policySection} id="gizlilik">
          <h2>Gizlilik Politikası</h2>
          <p>Rezervasyon ve iletişim süreçlerinde ad-soyad, telefon, e-posta, konaklama tarihleri, misafir sayısı, rezervasyon notları, işlem ve ödeme durumu/referansı gibi bilgiler işlenebilir. Site güvenliği ve hata teşhisi için sınırlı teknik kayıtlar da tutulabilir.</p>
          <p>Bu bilgiler rezervasyon talebini değerlendirmek, misafirle iletişim kurmak, konaklama hizmetini yerine getirmek, ödeme durumunu eşleştirmek, güvenliği sağlamak ve yasal yükümlülükleri yerine getirmek amacıyla kullanılır. Gerektiğinde ödeme kuruluşları, barındırma/altyapı hizmet sağlayıcıları ve kanunen yetkili mercilerle, amaçla sınırlı şekilde paylaşılabilir.</p>
          <p>Kredi/banka kartı numarası, CVV/CVC güvenlik kodu veya kartın tam son kullanma bilgisi Safira &amp; Destan yönetim sisteminde saklanmaz. Kartlı ödeme etkinleştirildiğinde kart verisi, ilgili lisanslı ödeme kuruluşunun güvenli ödeme akışında işlenir.</p>
          <p>Gizlilikle ilgili talepler için <a href="mailto:info@safiradestan.com">info@safiradestan.com</a> adresinden bizimle iletişime geçebilirsiniz.</p>
        </article>

        <article className={styles.policySection} id="kvkk">
          <h2>KVKK Aydınlatma Metni</h2>
          <p>6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında Safira &amp; Destan Villas işletmesi; rezervasyon, iletişim ve konaklama süreçlerinde elde edilen kişisel verileri veri sorumlusu sıfatıyla, işleme amacıyla bağlantılı, sınırlı ve ölçülü şekilde işler.</p>
          <p>Kişisel veriler; rezervasyon/hizmet ilişkisinin kurulması ve yürütülmesi, talep ve şikâyetlerin yönetilmesi, ödeme ve muhasebe kayıtlarının eşleştirilmesi, bilgi güvenliği, hukuki yükümlülüklerin yerine getirilmesi ve bir hakkın tesisi, kullanılması veya korunması amaçlarıyla; ilgili hukuki sebebin bulunduğu ölçüde elektronik formlar, telefon, e-posta, mesajlaşma kanalları ve ödeme/altyapı sistemleri üzerinden elde edilebilir.</p>
          <p>Veriler, hizmetin yürütülmesi için zorunlu olduğu ölçüde ödeme ve teknik hizmet sağlayıcılarına; hukuki zorunluluk halinde yetkili kamu kurumlarına aktarılabilir. Gereksiz veya süresiz veri saklama amaçlanmaz; kayıtlar işleme amacı ve uygulanabilir yasal saklama süreleriyle sınırlı tutulur.</p>
          <p>KVKK’nın 11. maddesi kapsamındaki haklarınız doğrultusunda kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme/yok etme şartlarının oluşup oluşmadığını değerlendirilmesini isteme ve kanunda yer alan diğer haklarınızı kullanmak için kimliğinizi doğrulayacak bilgilerle <a href="mailto:info@safiradestan.com">info@safiradestan.com</a> adresine başvurabilirsiniz.</p>
        </article>

        <article className={styles.policySection} id="mesafeli-hizmet-sozlesmesi">
          <h2>Mesafeli Hizmet Sözleşmesi</h2>
          <p><strong>Taraflar:</strong> Hizmet sağlayıcı Safira &amp; Destan Villas ile rezervasyon sırasında bilgilerini ileten misafir/tüketici arasında, uzaktan iletişim araçları kullanılarak kurulan konaklama hizmeti ilişkisini düzenler.</p>
          <p><strong>Sözleşmenin konusu:</strong> Rezervasyon ekranında veya yazılı teyitte belirtilen villa, giriş-çıkış tarihleri, gece sayısı, misafir sayısı ve toplam bedel karşılığında konaklama hizmetinin sunulmasıdır. İşlem özelindeki bu bilgiler sözleşmenin ayrılmaz parçasıdır.</p>
          <p><strong>Bedel ve ödeme:</strong> Toplam fiyat, ön ödeme tutarı, varsa kalan bakiye ve ödeme yöntemi rezervasyon onayından önce misafire gösterilir veya yazılı olarak bildirilir. Rezervasyonun kesinleşmesi için aşağıdaki bağlayıcı rezervasyon koşullarındaki ön ödeme hükmü uygulanır.</p>
          <p><strong>Hizmetin ifası:</strong> Konaklama, onaylanan tarihlerde ilgili villada gerçekleştirilir. Giriş/çıkış saatleri, hasar güvence bedeli, evcil hayvan ve sigara kuralları bu sayfadaki rezervasyon koşullarında belirtilmiştir.</p>
          <p><strong>İptal, iade ve cayma:</strong> İptal ve iade hükümleri bu sayfadaki bağlayıcı rezervasyon koşullarına tabidir. Belirli tarih veya dönemde ifa edilen konaklama hizmetleri için mevzuatta öngörülen cayma hakkı istisnası saklıdır; zorunlu tüketici mevzuatından doğan haklar ortadan kaldırılmaz.</p>
          <p><strong>İletişim ve uyuşmazlık:</strong> Talep ve şikâyetler <a href="mailto:info@safiradestan.com">info@safiradestan.com</a> üzerinden iletilebilir. Tüketicinin mevzuattan doğan hakem heyeti, mahkeme ve diğer başvuru hakları saklıdır.</p>
        </article>

        <article className={styles.policySection} id="on-bilgilendirme">
          <h2>Ön Bilgilendirme Formu</h2>
          <p>Rezervasyonun onaylanmasından ve tüketicinin ödeme yükümlülüğü altına girmesinden önce; hizmet sağlayıcının iletişim bilgileri, seçilen villa, konaklama tarihleri, misafir sayısı, toplam fiyat, ön ödeme/kalan ödeme bilgileri, ödeme yöntemi, giriş-çıkış saatleri ve uygulanabilir iptal/iade koşulları kullanıcıya gösterilir veya kalıcı bir iletişim kanalıyla bildirilir.</p>
          <p>Misafir, rezervasyon talebini onaylamadan önce bu sayfadaki Rezervasyon ve Konaklama Koşulları, Teslimat/İptal/İade Şartları, Mesafeli Hizmet Sözleşmesi ve Gizlilik/KVKK bilgilendirmelerini inceleyebilir. İşlem özelindeki fiyat ve tarih bilgileri bu genel metinlerin ayrılmaz tamamlayıcısıdır.</p>
          <p>Konaklama belirli tarihler için sunulduğundan cayma hakkı bakımından tarihli konaklama hizmetlerine ilişkin yasal istisna dikkate alınır. Rezervasyon koşullarında bundan bağımsız olarak tanımlanan iptal/iade hakları ayrıca uygulanır.</p>
        </article>

        <article className={styles.policySection} id="odeme-guvenligi">
          <h2>SSL ve Ödeme Güvenliği</h2>
          <p><strong>SSL/TLS:</strong> safiradestan.com bağlantısı HTTPS üzerinden sunulur. Rezervasyon ve ödeme adımlarında hassas veri aktarımı şifreli bağlantı üzerinden gerçekleştirilir.</p>
          <p><strong>Kart güvenliği:</strong> Safira &amp; Destan sistemleri kart numarası veya CVV/CVC saklamaz. Kartlı ödeme seçeneği yalnız ilgili ödeme kuruluşu hesabı aktif ve teknik entegrasyon hazır olduğunda kullanıcıya açılır.</p>
          <p><strong>Ödeme altyapısı durumu:</strong> iyzico ve PayTR için mağaza/entegrasyon başvuru süreçleri birbirinden bağımsızdır. Bu sayfadaki marka gösterimleri entegrasyon hazırlığını ve desteklenmesi planlanan ödeme yöntemlerini açıklar; sağlayıcı hesabı onaylanmadan o sağlayıcı üzerinden tahsilat yapılmaz.</p>
          <div className={styles.factChips} aria-label="Ödeme markaları">
            <span className={styles.factChip} style={{ minHeight: 54, display: "inline-flex", alignItems: "center", background: "#fff" }}>
              <img src="https://www.iyzico.com/assets/img/marka-kimligi/iyzico-pay-horizontal-white-tr.png" alt="iyzico ile Öde" width="108" height="27" loading="lazy" />
            </span>
            <span className={styles.factChip} style={{ minHeight: 54, display: "inline-flex", alignItems: "center", background: "#fff", color: "#1434CB", fontWeight: 700, letterSpacing: "0.08em" }}>VISA</span>
            <span className={styles.factChip} style={{ minHeight: 54, display: "inline-flex", alignItems: "center", background: "#fff", gap: 8 }}>
              <img src="https://www.mastercard.com/brandcenter/us/en/download-artwork/_jcr_content/root/container/container_1578756628/container_copy/container/tabs/item_1734020772487/container_45945280/carousel/item_1739263305851.coreimg.png/1751029718046/maestro-light.png" alt="Mastercard" width="72" height="44" loading="lazy" style={{ objectFit: "contain" }} />
              <span>Mastercard</span>
            </span>
          </div>
          <p>Visa ve Mastercard kabul markaları, ilgili kart markalarının güncel kullanım kuralları ve ödeme kuruluşunun onayı doğrultusunda kullanılır. PayTR ödeme seçeneği mağaza hesabı aktif hale gelmeden kullanıcıya sunulmaz.</p>
        </article>

        <article className={styles.policySection} id="rezervasyon-kosullari">
          <h2>Rezervasyon ve Konaklama Koşulları</h2>
          <div className={styles.factChips}>
            <span className={styles.factChip}>Giriş: {POLICY_SUMMARY.entry}</span>
            <span className={styles.factChip}>Çıkış: {POLICY_SUMMARY.checkout}</span>
            <span className={styles.factChip}>Rezervasyon Ön Ödemesi: {POLICY_SUMMARY.deposit}</span>
            <span className={styles.factChip}>Hasar Güvence Bedeli: {POLICY_SUMMARY.damageDeposit}</span>
            <span className={styles.factChip}>Evcil Hayvan: {POLICY_SUMMARY.pets}</span>
            <span className={styles.factChip}>Sigara: {POLICY_SUMMARY.smoking}</span>
          </div>
        </article>

        {POLICY_SECTIONS.map((section) => (
          <article className={styles.policySection} key={section.id} id={section.id}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </article>
        ))}
      </section>

      <section className={styles.policyCta}>
        <p>Rezervasyon talebi göndermeden önce bu koşulları ve yukarıdaki yasal bilgilendirmeleri incelemenizi rica ederiz.</p>
        <div className={styles.policyCtaLinks}>
          <Link href="/villa-safira#rezervasyon">Villa Safira için müsaitlik ara →</Link>
          <Link href="/villa-destan#rezervasyon">Villa Destan için müsaitlik ara →</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div>
        <div className={styles.policyCtaLinks} aria-label="Yasal bağlantılar">
          {LEGAL_LINKS.map((item) => <a href={item.href} key={`footer-${item.href}`}>{item.label}</a>)}
        </div>
        <div className={styles.footerBottom}>{safira.address.addressLocality} · {safira.address.addressRegion} <span>safiradestan.com</span><CookiePreferencesButton className={styles.footerCookieBtn} /></div>
      </footer>
    </main>
  );
}
