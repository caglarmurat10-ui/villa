import type { Metadata } from "next";
import Link from "next/link";
import { VILLAS } from "@/lib/villa-content";
import { REGION_GUIDE_PAGES, REGION_GUIDE_PAGE_SLUGS } from "@/lib/region-guide-pages";
import RegionGuideGrid from "@/components/RegionGuideGrid";
import CookiePreferencesButton from "@/components/analytics/CookiePreferencesButton";
import styles from "../site.module.css";

const ORIGIN = "https://safiradestan.com";
const CANONICAL = `${ORIGIN}/rehber`;

const TITLE = "Patara & Kaş Bölge Rehberi | Safira & Destan Villas";
const DESCRIPTION = "Patara Antik Kenti, Patara Plajı, Kaputaş Plajı, Xanthos, Saklıkent Kanyonu, Kaş ve Kalkan — Villa Safira ve Villa Destan çevresinde gezilecek gerçek yerler.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RegionGuidePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana sayfa", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: "Bölge Rehberi", item: CANONICAL },
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
      <a href="#rehber-icerik" className={styles.skipLink}>İçeriğe atla</a>
      <section className={styles.policyHead}>
        <nav className={styles.nav} aria-label="Ana menü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}>
            <Link href="/">Ana sayfa</Link>
            <Link href="/villa-safira">Villa Safira</Link>
            <Link href="/villa-destan">Villa Destan</Link>
          </div>
        </nav>
        <div className={styles.policyHeadCopy} id="rehber-icerik" tabIndex={-1}>
          <span className={styles.eyebrow}>PATARA · KAŞ · ANTALYA</span>
          <h1 className={styles.policyTitle}>Patara &amp; Kaş Bölge Rehberi</h1>
          <p className={styles.lead}>Villa Safira ve Villa Destan'ın bulunduğu Patara/Gelemiş çevresinde tarih, deniz ve doğa dolu gerçek gezi noktaları.</p>
        </div>
      </section>

      <section className={styles.policyBody}>
        <h2>Patara ve Kaş çevresini planlamak</h2>
        <p>Bu rehber, Villa Safira ve Villa Destan'da konaklarken çevrede görmek isteyebileceğiniz yerleri tek noktada toplar. Patara Antik Kenti ve Patara Plajı gibi birbirine bağlı durakların yanında Kaş, Kalkan, Kaputaş Plajı, Xanthos ve Saklıkent Kanyonu gibi farklı gezi seçeneklerini de inceleyebilirsiniz. Amacımız değişebilen saat, ücret ve yol süresi bilgilerini sabitlemek yerine, bölgenin kalıcı özelliklerini ve hangi durakların birbiriyle anlamlı bir rota oluşturduğunu anlatmaktır.</p>
        <p>Ziyaret gününde çalışma saatleri, giriş kuralları, koruma uygulamaları ve yol koşulları değişebileceği için ayrıntıları resmi kaynaklardan ve güncel harita verilerinden kontrol etmenizi öneririz. Aşağıdaki detaylı rehberler Patara, plaj, antik kent, Kaş ve Kalkan için ayrı ayrı hazırlanmıştır; her sayfadan diğer rehberlere ve villa sayfalarına geçerek tatil planınızı kendi temponuza göre oluşturabilirsiniz.</p>

        <h2>Detaylı rehberler</h2>
        <ul>
          {REGION_GUIDE_PAGE_SLUGS.map((slug) => (
            <li key={slug}><Link href={`/rehber/${slug}`}>{REGION_GUIDE_PAGES[slug].title.split(" — ")[0]} →</Link></li>
          ))}
        </ul>
        <RegionGuideGrid />
      </section>

      <section className={styles.policyCta}>
        <p>Tatilinizi planlarken villa seçiminize de göz atın.</p>
        <div className={styles.policyCtaLinks}>
          <Link href="/villa-safira">Villa Safira'yı keşfet →</Link>
          <Link href="/villa-destan">Villa Destan'ı keşfet →</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div>
        <div className={styles.footerBottom}><span>{VILLAS["villa-safira"].address.addressLocality} · {VILLAS["villa-safira"].address.addressRegion}</span><span>safiradestan.com</span><CookiePreferencesButton className={styles.footerCookieBtn} /></div>
      </footer>
    </main>
  );
}
