import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicBookingWidget from "@/components/PublicBookingWidget";
import { listPriceRanges, listReservations } from "@/lib/db";
import type { Villa } from "@/lib/types";
import styles from "../site.module.css";

const villas = {
  "villa-safira": {
    villa: "Safira" as Villa,
    name: "Villa Safira",
    cover: "/villas/safira-hero-20260830.jpg",
    secondary: "/villas/safira-alt-20260830.jpg",
    label: "VILLA 01",
    description: "Pataraâ€™nÄ±n doÄŸal dokusu iÃ§inde, Ã¶zel alanÄ±nÄ±zdan vazgeÃ§meden sakin ve Ã¶zgÃ¼r bir Akdeniz tatili.",
    quote: "GÃ¼nÃ¼n hiÃ§bir saatinde acele etmeniz gerekmeyen bir yer.",
  },
  "villa-destan": {
    villa: "Destan" as Villa,
    name: "Villa Destan",
    cover: "/villas/destan-hero-20260830.jpg",
    secondary: "/villas/destan-suite-20260830.jpg",
    label: "VILLA 02",
    description: "Ã–zel havuzu, geniÅŸ yaÅŸam alanlarÄ± ve gÃ¼Ã§lÃ¼ iÃ§ mekÃ¢n detaylarÄ±yla kendi ritminizde bir tatil deneyimi.",
    quote: "DÄ±ÅŸarÄ± Ã§Ä±kmak istemeyeceÄŸiniz kadar size ait.",
  },
} as const;

type VillaSlug = keyof typeof villas;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!(slug in villas)) return {};
  const villa = villas[slug as VillaSlug];
  return {
    title: `${villa.name} | Safira & Destan Villas`,
    description: `${villa.name} Patara, KaÅŸ. GerÃ§ek fotoÄŸraflarÄ± inceleyin, canlÄ± mÃ¼saitlik ve dÃ¶nemsel fiyat kontrolÃ¼ yapÄ±n.`,
  };
}

export default async function VillaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in villas)) notFound();
  const villa = villas[slug as VillaSlug];
  const [reservations, prices] = await Promise.all([listReservations(), listPriceRanges()]);
  const bookingReservations = reservations.map(({ villa: itemVilla, checkIn, checkOut }) => ({ villa: itemVilla, checkIn, checkOut }));
  const bookingPrices = prices.map(({ villa: itemVilla, startDate, endDate, nightlyRate }) => ({ villa: itemVilla, startDate, endDate, nightlyRate }));

  return (
    <main className={styles.page}>
      <section className={`${styles.hero} ${styles.detailHero}`}>
        <img className={styles.heroImage} src={villa.cover} alt={villa.name} />
        <div className={styles.heroShade} />
        <nav className={styles.nav} aria-label="Villa menÃ¼sÃ¼">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}><Link href="/">Ana sayfa</Link><a href="#galeri">Villa</a><a className={styles.cta} href="#rezervasyon">MÃ¼saitlik</a></div>
        </nav>
        <div className={styles.detailHeroCopy}><span className={styles.eyebrow}>{villa.label} Â· PATARA</span><h1 className={styles.title}>{villa.name}</h1><p className={styles.lead}>{villa.description}</p><a className={styles.primary} href="#rezervasyon">Tarih kontrol et</a></div>
      </section>

      <section className={styles.detailIntro}>
        <div><span className={styles.kicker}>BÄ°RKAÃ‡ GÃœN DEÄÄ°L, BÄ°R HÄ°S</span><h2>{villa.quote}</h2></div>
        <p>Burada tatilin merkezi villanÄ±n kendisi. SabahÄ±nÄ±zÄ± havuz baÅŸÄ±nda baÅŸlatÄ±n, Patara ve KaÅŸâ€™Ä± kendi temponuzda keÅŸfedin, gÃ¼nÃ¼n sonunda tekrar tamamen size ait olan alana dÃ¶nÃ¼n.</p>
      </section>

      <section className={styles.gallery} id="galeri">
        <figure className={styles.galleryMain}><img src={villa.cover} alt={`${villa.name} dÄ±ÅŸ alanÄ±`} /></figure>
        <figure className={styles.gallerySide}><img src={villa.secondary} alt={`${villa.name} yaÅŸam alanÄ±`} /></figure>
      </section>

      <section className={styles.detailFeatures}>
        <div><small>01</small><h3>Ã–zel alan</h3><p>Villa ve dÄ±ÅŸ yaÅŸam alanlarÄ±, tatili kendi programÄ±nÄ±zla yaÅŸayabilmeniz iÃ§in tasarlanmÄ±ÅŸ baÄŸÄ±msÄ±z bir deneyim sunar.</p></div>
        <div><small>02</small><h3>CanlÄ± takvim</h3><p>MÃ¼saitlik, yÃ¶netim panelindeki gerÃ§ek rezervasyon kayÄ±tlarÄ± Ã¼zerinden kontrol edilir.</p></div>
        <div><small>03</small><h3>DÃ¶nemsel fiyat</h3><p>Tarihinizde fiyat tanÄ±mlÄ±ysa toplam konaklama bedelini sistem doÄŸrudan hesaplar.</p></div>
      </section>

      <section className={styles.bookingBand} id="rezervasyon">
        <div className={styles.bookingWrap}>
          <div className={styles.bookingIntro}><span className={styles.kicker}>{villa.name.toUpperCase()}</span><h2>Tarihinizi<br />kontrol edin.</h2><p>SeÃ§tiÄŸiniz gÃ¼nler yÃ¶netim sistemimizdeki rezervasyonlarla karÅŸÄ±laÅŸtÄ±rÄ±lÄ±r.</p></div>
          <PublicBookingWidget reservations={bookingReservations} prices={bookingPrices} initialVilla={villa.villa} />
        </div>
      </section>

      <section className={styles.nextVilla}>
        <span className={styles.kicker}>DÄ°ÄER SEÃ‡ENEK</span>
        <h2>Ä°ki karakter.<br />AynÄ± Ã¶zen.</h2>
        <Link href={slug === "villa-safira" ? "/villa-destan" : "/villa-safira"}>{slug === "villa-safira" ? "Villa Destanâ€™Ä±" : "Villa Safiraâ€™yÄ±"} keÅŸfet â†’</Link>
      </section>

      <footer className={styles.footer}><div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div><div className={styles.footerBottom}>Patara Â· KaÅŸ Â· Antalya <span>safiradestan.com</span></div></footer>
    </main>
  );
}
