import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicBookingWidget from "@/components/PublicBookingWidget";
import { listPriceRanges, listReservations } from "@/lib/db";
import type { Villa } from "@/lib/types";
import styles from "../site.module.css";

const ORIGIN = "https://safiradestan.com";

const villas = {
  "villa-safira": {
    villa: "Safira" as Villa,
    name: "Villa Safira",
    cover: "/villas/safira-hero-20260830.jpg",
    secondary: "/villas/safira-alt-20260830.jpg",
    label: "VILLA 01",
    instagram: "https://www.instagram.com/villasafirapatara/",
    description: "Patara’nın doğal dokusu içinde, özel havuzunuzdan ve bağımsız yaşam alanınızdan vazgeçmeden sakin ve özgür bir Akdeniz tatili.",
    quote: "Günün hiçbir saatinde acele etmeniz gerekmeyen bir yer.",
  },
  "villa-destan": {
    villa: "Destan" as Villa,
    name: "Villa Destan",
    cover: "/villas/destan-hero-20260830.jpg",
    secondary: "/villas/destan-suite-20260830.jpg",
    label: "VILLA 02",
    instagram: "https://www.instagram.com/villadestanpatara/",
    description: "Patara, Kaş’ta özel havuzu, geniş yaşam alanları ve güçlü iç mekân detaylarıyla kendi ritminizde, mahremiyet odaklı bir villa tatili.",
    quote: "Dışarı çıkmak istemeyeceğiniz kadar size ait.",
  },
} as const;

type VillaSlug = keyof typeof villas;

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
  const [reservations, prices] = await Promise.all([listReservations(), listPriceRanges()]);
  const bookingReservations = reservations.map(({ villa: itemVilla, checkIn, checkOut }) => ({ villa: itemVilla, checkIn, checkOut }));
  const bookingPrices = prices.map(({ villa: itemVilla, startDate, endDate, nightlyRate }) => ({ villa: itemVilla, startDate, endDate, nightlyRate }));
  const canonical = `${ORIGIN}/${slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: villa.name,
    description: villa.description,
    url: canonical,
    image: [`${ORIGIN}${villa.cover}`, `${ORIGIN}${villa.secondary}`],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Patara, Kaş",
      addressRegion: "Antalya",
      addressCountry: "TR",
    },
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Özel havuz", value: true },
      { "@type": "LocationFeatureSpecification", name: "Doğrudan rezervasyon", value: true },
      { "@type": "LocationFeatureSpecification", name: "Canlı müsaitlik", value: true },
    ],
    sameAs: [villa.instagram],
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <section className={`${styles.hero} ${styles.detailHero}`}>
        <img className={styles.heroImage} src={villa.cover} alt={`${villa.name} Patara Kaş özel havuzlu villa`} />
        <div className={styles.heroShade} />
        <nav className={styles.nav} aria-label="Villa menüsü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}><Link href="/">Ana sayfa</Link><a href="#galeri">Villa</a><a className={styles.cta} href="#rezervasyon">Müsaitlik</a></div>
        </nav>
        <div className={styles.detailHeroCopy}><span className={styles.eyebrow}>{villa.label} · PATARA · KAŞ</span><h1 className={styles.title}>{villa.name}</h1><p className={styles.lead}>{villa.description}</p><a className={styles.primary} href="#rezervasyon">Tarih kontrol et</a></div>
      </section>

      <section className={styles.detailIntro}>
        <div><span className={styles.kicker}>PATARA ÖZEL HAVUZLU VİLLA</span><h2>{villa.quote}</h2></div>
        <p>Burada tatilin merkezi villanın kendisi. Sabahınızı özel havuz başında başlatın, Patara ve Kaş’ı kendi temponuzda keşfedin, günün sonunda tekrar tamamen size ait olan alana dönün.</p>
      </section>

      <section className={styles.gallery} id="galeri">
        <figure className={styles.galleryMain}><img src={villa.cover} alt={`${villa.name} Patara dış alan ve özel havuz`} /></figure>
        <figure className={styles.gallerySide}><img src={villa.secondary} alt={`${villa.name} yaşam alanı ve villa detayları`} /></figure>
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

      <section className={styles.nextVilla}>
        <span className={styles.kicker}>DİĞER SEÇENEK</span>
        <h2>İki karakter.<br />Aynı özen.</h2>
        <Link href={slug === "villa-safira" ? "/villa-destan" : "/villa-safira"}>{slug === "villa-safira" ? "Villa Destan’ı" : "Villa Safira’yı"} keşfet →</Link>
        <a href={villa.instagram} rel="me noopener noreferrer">{villa.name} Instagram →</a>
      </section>

      <footer className={styles.footer}><div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div><div className={styles.footerBottom}>Patara · Kaş · Antalya <span>safiradestan.com</span></div></footer>
    </main>
  );
}
