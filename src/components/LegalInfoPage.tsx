import type { Metadata } from "next";
import Link from "next/link";
import CookiePreferencesButton from "@/components/analytics/CookiePreferencesButton";
import { LEGAL_PAGE_LINKS, type LegalPageContent } from "@/lib/legal-content";
import { WHATSAPP_PHONE_DISPLAY_TR } from "@/lib/contact";
import styles from "@/app/site/site.module.css";

const ORIGIN = "https://safiradestan.com";

export function buildLegalMetadata(page: LegalPageContent): Metadata {
  const canonical = `${ORIGIN}/${page.slug}`;
  return {
    title: `${page.title} | Safira & Destan Villas`,
    description: page.description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { title: `${page.title} | Safira & Destan Villas`, description: page.description, url: canonical, type: "website" },
    twitter: { card: "summary_large_image", title: `${page.title} | Safira & Destan Villas`, description: page.description },
  };
}

export default function LegalInfoPage({ page }: { page: LegalPageContent }) {
  const canonical = `${ORIGIN}/${page.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana sayfa", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: page.title, item: canonical },
        ],
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}/#webpage`,
        url: canonical,
        name: page.title,
        description: page.description,
        isPartOf: { "@type": "WebSite", "@id": `${ORIGIN}/#website` },
      },
    ],
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <a href="#legal-icerik" className={styles.skipLink}>İçeriğe atla</a>
      <section className={styles.policyHead}>
        <nav className={styles.nav} aria-label="Ana menü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}>
            <Link href="/">Ana sayfa</Link>
            <Link href="/rezervasyon-kosullari">Rezervasyon Koşulları</Link>
          </div>
        </nav>
        <div className={styles.policyHeadCopy} id="legal-icerik" tabIndex={-1}>
          <span className={styles.eyebrow}>SAFIRA &amp; DESTAN VILLAS</span>
          <h1 className={styles.policyTitle}>{page.title}</h1>
          <p className={styles.lead}>{page.description}</p>
        </div>
      </section>

      <section className={styles.policyBody}>
        <article className={styles.policySection}>
          {page.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          {page.slug === "hakkimizda" ? (
            <p><strong>İletişim:</strong> <a href="mailto:info@safiradestan.com">info@safiradestan.com</a> · {WHATSAPP_PHONE_DISPLAY_TR} · Patara/Gelemiş · Kaş · Antalya</p>
          ) : null}
        </article>
      </section>

      <section className={styles.policyCta}>
        <p>Rezervasyon veya ödeme işlemi öncesinde ilgili bilgilendirme metinlerinin tamamını inceleyebilirsiniz.</p>
        <div className={styles.policyCtaLinks}>
          <Link href="/rezervasyon-kosullari">Rezervasyon ve Konaklama Koşulları →</Link>
          {LEGAL_PAGE_LINKS.filter((item) => item.href !== `/${page.slug}`).map((item) => (
            <Link href={item.href} key={item.href}>{item.label} →</Link>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div>
        <div className={styles.footerBottom}>Patara · Kaş · Antalya <span>safiradestan.com</span><CookiePreferencesButton className={styles.footerCookieBtn} /></div>
      </footer>
    </main>
  );
}
