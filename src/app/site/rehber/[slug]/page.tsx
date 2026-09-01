import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { VILLAS } from "@/lib/villa-content";
import { GUIDE_PLACES, guideMapsUrl } from "@/lib/region-guide";
import { REGION_GUIDE_PAGES, REGION_GUIDE_PAGE_SLUGS, type RegionGuidePageSlug } from "@/lib/region-guide-pages";
import CookiePreferencesButton from "@/components/analytics/CookiePreferencesButton";
import TrackedGuidePlaceLink from "@/components/analytics/TrackedGuidePlaceLink";
import styles from "../../site.module.css";

const ORIGIN = "https://safiradestan.com";

function isValidSlug(slug: string): slug is RegionGuidePageSlug {
  return (REGION_GUIDE_PAGE_SLUGS as string[]).includes(slug);
}

export function generateStaticParams() {
  return REGION_GUIDE_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) return {};
  const page = REGION_GUIDE_PAGES[slug];
  const canonical = `${ORIGIN}/rehber/${slug}`;
  return {
    title: `${page.title} | Safira & Destan Villas`,
    description: page.metaDescription,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { title: page.title, description: page.metaDescription, url: canonical, type: "article" },
    twitter: { card: "summary_large_image", title: page.title, description: page.metaDescription },
  };
}

export default async function RegionGuideSubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  const page = REGION_GUIDE_PAGES[slug];
  const canonical = `${ORIGIN}/rehber/${slug}`;
  const relatedPlaces = page.relatedPlaceIds.map((id) => GUIDE_PLACES.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana sayfa", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: "Bölge Rehberi", item: `${ORIGIN}/rehber` },
          { "@type": "ListItem", position: 3, name: page.kicker, item: canonical },
        ],
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}/#webpage`,
        url: canonical,
        name: page.title,
        description: page.metaDescription,
        isPartOf: { "@type": "WebSite", "@id": `${ORIGIN}/#website` },
      },
      ...(page.faq.length > 0 ? [{
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        mainEntity: page.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }] : []),
    ],
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <a href="#rehber-alt-icerik" className={styles.skipLink}>İçeriğe atla</a>
      <section className={styles.policyHead}>
        <nav className={styles.nav} aria-label="Ana menü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}>
            <Link href="/">Ana sayfa</Link>
            <Link href="/rehber">Bölge Rehberi</Link>
            <Link href="/villa-safira">Villa Safira</Link>
            <Link href="/villa-destan">Villa Destan</Link>
          </div>
        </nav>
        <div className={styles.policyHeadCopy} id="rehber-alt-icerik" tabIndex={-1}>
          <nav aria-label="Breadcrumb" style={{fontSize:12,color:"#8a8f8c",marginBottom:8}}>
            <Link href="/">Ana sayfa</Link> · <Link href="/rehber">Bölge Rehberi</Link> · <span>{page.kicker}</span>
          </nav>
          <span className={styles.eyebrow}>{page.kicker}</span>
          <h1 className={styles.policyTitle}>{page.title.split(" — ")[0]}</h1>
          <p className={styles.lead}>{page.intro}</p>
        </div>
      </section>

      <section className={styles.policyBody}>
        {page.sections.map((section) => (
          <div key={section.heading} style={{marginBottom:24}}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </div>
        ))}

        {relatedPlaces.length > 0 && (
          <div style={{marginTop:20}}>
            <h2>Haritada konumlar</h2>
            <ul>
              {relatedPlaces.map((place) => (
                <li key={place.id}>
                  <TrackedGuidePlaceLink href={guideMapsUrl(place.mapsQuery)} target="_blank" rel="noopener noreferrer" placeId={place.id} placeName={place.name} placeCategory={place.category}>
                    {place.name} — Haritada aç
                  </TrackedGuidePlaceLink>
                </li>
              ))}
            </ul>
          </div>
        )}

        {page.faq.length > 0 && (
          <div style={{marginTop:20}}>
            <h2>Sık sorulanlar</h2>
            {page.faq.map((item) => (
              <details className={styles.faqItem} key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className={styles.policyCta}>
        <p>Bu bölgeye yakın villamızı keşfedin.</p>
        <div className={styles.policyCtaLinks}>
          <Link href="/villa-safira">Villa Safira'yı keşfet →</Link>
          <Link href="/villa-destan">Villa Destan'ı keşfet →</Link>
          <Link href="/rehber">Tüm bölge rehberine dön →</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div>
        <div className={styles.footerBottom}><span>{VILLAS["villa-safira"].address.addressLocality} · {VILLAS["villa-safira"].address.addressRegion}</span><span>safiradestan.com</span><CookiePreferencesButton className={styles.footerCookieBtn} /></div>
      </footer>
    </main>
  );
}
