import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicBookingWidget from "@/components/PublicBookingWidget";
import VillaGalleryLightbox from "@/components/VillaGalleryLightbox";
import { getVillaLocations, listPriceRanges, listReservations } from "@/lib/db";
import { VILLAS, FAQ_ITEMS, REGION_INFO, formatAddress, type VillaSlug } from "@/lib/villa-content";
import styles from "../site.module.css";

const ORIGIN = "https://safiradestan.com";
const villas = VILLAS;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!(slug in villas)) return {};
  const villa = villas[slug as VillaSlug];
  const canonical = `${ORIGIN}/${slug}`;
  const title = `${villa.name} | Patara Kaş Özel Havuzlu Villa`;
  const description = `${villa.name}, Patara Kaş'ta özel havuzlu villa tatili. Gerçek fotoğrafları inceleyin, canlı müsaitlik ve dönemsel fiyat kontrolü yapın, doğrudan rezervasyon talebi gönderin.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Safira & Destan Villas",
      locale: "tr_TR",
      type: "website",
      images: [{ url: villa.cover, alt: `${villa.name} Patara Kaş özel havuzlu villa` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [villa.cover],
    },
  };
}

export default async function VillaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in villas)) notFound();
  const villa = villas[slug as VillaSlug];
  const [reservations, prices, locations] = await Promise.all([listReservations(), listPriceRanges(), getVillaLocations()]);
  const bookingReservations = reservations.map(({ villa: itemVilla, checkIn, checkOut }) => ({ villa: itemVilla, checkIn, checkOut }));
  const bookingPrices = prices.map(({ villa: itemVilla, startDate, endDate, nightlyRate }) => ({ villa: itemVilla, startDate, endDate, nightlyRate }));
  const mapsUrl = locations[villa.villa];
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${villa.geo.lat},${villa.geo.lng}`;
  const canonical = `${ORIGIN}/${slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "VacationRental",
        "@id": `${canonical}/#vacationrental`,
        name: villa.name,
        description: villa.description,
        url: canonical,
        image: [`${ORIGIN}${villa.cover}`, `${ORIGIN}${villa.secondary}`],
        address: {
          "@type": "PostalAddress",
          streetAddress: villa.address.streetAddress,
          addressLocality: villa.address.addressLocality,
          addressRegion: villa.address.addressRegion,
          postalCode: villa.address.postalCode,
          addressCountry: villa.address.addressCountry,
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: villa.geo.lat,
          longitude: villa.geo.lng,
        },
        amenityFeature: [
          { "@type": "LocationFeatureSpecification", name: "Özel havuz", value: true },
          { "@type": "LocationFeatureSpecification", name: "Doğrudan rezervasyon", value: true },
          { "@type": "LocationFeatureSpecification", name: "Canlı müsaitlik", value: true },
          ...villa.highlights
            .filter((item) => item.title !== "Özel havuz")
            .map((item) => ({ "@type": "LocationFeatureSpecification", name: item.title, value: true })),
        ],
        sameAs: [villa.instagram, villa.facebook],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana sayfa", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: villa.name, item: canonical },
        ],
      },
    ],
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <a href="#ana-icerik" className={styles.skipLink}>İçeriğe atla</a>
      <section className={`${styles.hero} ${styles.detailHero}`}>
        <img className={styles.heroImage} src={villa.cover} alt={villa.coverAlt} fetchPriority="high" />
        <div className={styles.heroShade} />
        <nav className={styles.nav} aria-label="Villa menüsü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}><Link href="/">Ana sayfa</Link><a href="#galeri">Villa</a><a href="#konum">Konum</a><a href="#sss">SSS</a><a className={styles.cta} href="#rezervasyon">Müsaitlik</a></div>
        </nav>
        <div className={styles.detailHeroCopy} id="ana-icerik" tabIndex={-1}><span className={styles.eyebrow}>{villa.label} · PATARA · KAŞ</span><h1 className={styles.title}>{villa.name}</h1><p className={styles.lead}>{villa.description}</p><a className={styles.primary} href="#rezervasyon">Tarih kontrol et</a></div>
      </section>

      <section className={styles.detailIntro}>
        <div><span className={styles.kicker}>PATARA ÖZEL HAVUZLU VİLLA</span><h2>{villa.quote}</h2></div>
        <p>Burada tatilin merkezi villanın kendisi. Sabahınızı özel havuz başında başlatın, Patara ve Kaş’ı kendi temponuzda keşfedin, günün sonunda tekrar tamamen size ait olan alana dönün.</p>
      </section>

      <section className={styles.gallery} id="galeri">
        <figure className={styles.galleryMain}><img src={villa.cover} alt={villa.coverAlt} loading="eager" /></figure>
        <figure className={styles.gallerySide}><img src={villa.secondary} alt={villa.secondaryAlt} loading="lazy" /></figure>
      </section>

      <section className={styles.highlights}>
        <span className={styles.kicker}>ÖNE ÇIKANLAR</span>
        <h2>{villa.name}’da sizi bekleyenler</h2>
        <div className={styles.highlightGrid}>
          {villa.highlights.map((item) => (
            <div className={styles.highlightCard} key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} style={{ paddingTop: 0 }}>
        <VillaGalleryLightbox images={villa.gallery} villaName={villa.name} />
      </section>

      <section className={styles.locationDetail} id="konum">
        <span className={styles.kicker}>KONUM & ULAŞIM</span>
        <h2>{villa.name} nerede?</h2>
        <div className={styles.locationCard}>
          <div className={styles.locationInfo}>
            <h3>{villa.name}</h3>
            <p className={styles.locationAddress}><b>Açık adres</b>{formatAddress(villa.address)}</p>
            <p className={styles.locationRegionText}>{REGION_INFO.body}</p>
            <div className={styles.locationActions}>
              {mapsUrl && <a className={styles.locationActionPrimary} href={mapsUrl} target="_blank" rel="noopener noreferrer">Google Maps’te Aç</a>}
              <a className={styles.locationActionSecondary} href={directionsUrl} target="_blank" rel="noopener noreferrer">Yol Tarifi Al</a>
            </div>
          </div>
          <div className={styles.locationVisual} aria-hidden="true" style={{ backgroundImage: `url(${villa.cover})` }}>
            <span>{villa.address.addressLocality} · {villa.address.addressRegion}</span>
          </div>
        </div>
      </section>

      <section className={styles.detailFeatures}>
        <div><small>01</small><h3>Özel havuz ve bağımsız alan</h3><p>Villa ve dış yaşam alanları, Patara’daki tatilinizi kendi programınızla yaşayabilmeniz için bağımsız bir deneyim sunar.</p></div>
        <div><small>02</small><h3>Canlı müsaitlik</h3><p>Müsaitlik, yönetim panelindeki gerçek rezervasyon kayıtları üzerinden kontrol edilir.</p></div>
        <div><small>03</small><h3>Dönemsel fiyat</h3><p>Tarihinizde fiyat tanımlıysa toplam konaklama bedelini sistem doğrudan hesaplar.</p></div>
      </section>

      <section className={styles.bookingBand} id="rezervasyon">
        <div className={styles.bookingWrap}>
          <div className={styles.bookingIntro}><span className={styles.kicker}>{villa.name.toUpperCase()}</span><h2>Tarihinizi<br />kontrol edin.</h2><p>Seçtiğiniz günler yönetim sistemimizdeki rezervasyonlarla karşılaştırılır. Müsaitse doğrudan rezervasyon talebi gönderebilirsiniz.</p></div>
          <PublicBookingWidget reservations={bookingReservations} prices={bookingPrices} initialVilla={villa.villa} />
        </div>
      </section>

      <section className={styles.faq} id="sss">
        <span className={styles.kicker}>SIK SORULAN SORULAR</span>
        <h2>Merak edilenler</h2>
        {FAQ_ITEMS.map((item) => (
          <details className={styles.faqItem} key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>

      <section className={styles.nextVilla}>
        <span className={styles.kicker}>DİĞER SEÇENEK</span>
        <h2>İki karakter.<br />Aynı özen.</h2>
        <Link href={slug === "villa-safira" ? "/villa-destan" : "/villa-safira"}>{slug === "villa-safira" ? "Villa Destan’ı" : "Villa Safira’yı"} keşfet →</Link>
        <div className={styles.socialRow}>
          <a href={villa.instagram} rel="me noopener noreferrer">{villa.name} Instagram →</a>
          <a href={villa.facebook} rel="me noopener noreferrer">{villa.name} Facebook →</a>
        </div>
      </section>

      <footer className={styles.footer}><div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div><div className={styles.footerBottom}>Patara · Kaş · Antalya <span>safiradestan.com</span></div></footer>

      <div className={styles.stickyCta}>
        <a href="#rezervasyon">Tarih kontrol et</a>
      </div>
    </main>
  );
}
