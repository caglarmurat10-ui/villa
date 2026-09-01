import type { Metadata } from "next";
import Link from "next/link";
import PublicBookingWidget from "@/components/PublicBookingWidget";
import { getVillaLocations, listPriceRanges, listReservations } from "@/lib/db";
import { VILLAS, FAQ_ITEMS, REGION_INFO } from "@/lib/villa-content";
import styles from "./site.module.css";

export const dynamic = "force-dynamic";

const ORIGIN = "https://safiradestan.com";
const SOCIAL_LINKS = [
  VILLAS["villa-safira"].instagram,
  VILLAS["villa-destan"].instagram,
  VILLAS["villa-safira"].facebook,
  VILLAS["villa-destan"].facebook,
];

export const metadata: Metadata = {
  title: "Patara Kaş Özel Havuzlu Villa | Villa Safira & Villa Destan",
  description: "Patara, Kaş'ta Villa Safira ve Villa Destan. Özel havuzlu villa tatili için gerçek fotoğrafları inceleyin, canlı müsaitlik ve fiyat kontrolü yapın, doğrudan rezervasyon talebi gönderin.",
  alternates: { canonical: ORIGIN },
  openGraph: {
    title: "Patara Kaş Özel Havuzlu Villa | Villa Safira & Villa Destan",
    description: "Patara'da iki özel havuzlu villa; canlı müsaitlik, dönemsel fiyat ve doğrudan rezervasyon.",
    url: ORIGIN,
    siteName: "Safira & Destan Villas",
    locale: "tr_TR",
    type: "website",
    images: [{ url: "/villas/safira-hero-20260830.jpg", alt: "Villa Safira Patara Kaş özel havuzlu villa" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Safira & Destan Villas | Patara · Kaş",
    description: "Özel havuzlu villa, canlı müsaitlik ve doğrudan rezervasyon.",
    images: ["/villas/safira-hero-20260830.jpg"],
  },
};

const MEDIA = {
  safiraHero: VILLAS["villa-safira"].cover,
  safiraAlt: VILLAS["villa-safira"].secondary,
  destanHero: VILLAS["villa-destan"].cover,
  destanSuite: VILLAS["villa-destan"].secondary,
} as const;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${ORIGIN}/#website`,
      url: ORIGIN,
      name: "Safira & Destan Villas",
      inLanguage: "tr-TR",
    },
    {
      "@type": "Organization",
      "@id": `${ORIGIN}/#organization`,
      name: "Safira & Destan Villas",
      url: ORIGIN,
      sameAs: SOCIAL_LINKS,
    },
  ],
};

export default async function PublicHomePage() {
  const [reservations, prices, locations] = await Promise.all([listReservations(), listPriceRanges(), getVillaLocations()]);
  const bookingReservations = reservations.map(({ villa, checkIn, checkOut }) => ({ villa, checkIn, checkOut }));
  const bookingPrices = prices.map(({ villa, startDate, endDate, nightlyRate }) => ({ villa, startDate, endDate, nightlyRate }));

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <a href="#ana-icerik" className={styles.skipLink}>İçeriğe atla</a>
      <section className={styles.hero}>
        <img className={styles.heroImage} src={MEDIA.safiraHero} alt="Patara Kaş Villa Safira özel havuzu ve dış yaşam alanı" fetchPriority="high" />
        <div className={styles.heroShade} />
        <nav className={styles.nav} aria-label="Ana menü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}>
            <a href="#villalar">Villalar</a>
            <a href="#musaitlik">Müsaitlik</a>
            <a href="#deneyim">Deneyim</a>
            <a href="#konum">Konum</a>
            <a href="#sss">SSS</a>
            <a href="#iletisim" className={styles.cta}>İletişim</a>
          </div>
        </nav>

        <div className={styles.heroCopy} id="ana-icerik" tabIndex={-1}>
          <div className={styles.eyebrow}>Patara · Kaş · Antalya</div>
          <h1 className={styles.title}>Akdeniz’de<br />kendinize ait<br />bir yer.</h1>
          <p className={styles.lead}>Villa Safira ve Villa Destan. Patara, Kaş’ta özel havuzlu villa tatili; özgürlük, mahremiyet ve doğrudan rezervasyon kolaylığıyla size ait bir Akdeniz deneyimi.</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#musaitlik">Müsaitlik ara</a>
            <a className={styles.secondary} href="#villalar">Villaları keşfet</a>
          </div>
        </div>
        <div className={styles.heroNote}><span>01</span><p>İki ayrı villa.<br />Tek bir özenli deneyim.</p></div>
      </section>

      <section className={styles.bookingBand} id="musaitlik">
        <div className={styles.bookingWrap}>
          <div className={styles.bookingIntro}><span className={styles.kicker}>CANLI TAKVİM</span><h2>Tatil tarihiniz<br />müsait mi?</h2><p>Takvim doğrudan yönetim sistemindeki rezervasyonlarla kontrol edilir.</p></div>
          <PublicBookingWidget reservations={bookingReservations} prices={bookingPrices} />
        </div>
      </section>

      <section className={styles.section} id="villalar">
        <div className={styles.editorialHead}><span className={styles.kicker}>PATARA VİLLA KİRALAMA</span><h2>Hangisi sizin<br />tatiliniz?</h2><p>Villa Safira ve Villa Destan’ı gerçek fotoğraflarıyla keşfedin; Patara’da özel havuzlu villa tatili için size en uygun seçeneği bulun.</p></div>
        <div className={styles.villaGrid}>
          <Link className={styles.villaStory} href="/villa-safira">
            <div className={styles.storyImage}><img src={MEDIA.safiraHero} alt="Villa Safira Patara Kaş dış görünüm ve özel havuz" loading="lazy" /><span>Safira&apos;yı keşfet ↗</span></div>
            <div className={styles.storyMeta}><div><small>VILLA 01</small><h3>Villa Safira</h3></div><p>Doğayla çevrili, ferah ve özel havuzlu bir Patara villa tatili.</p></div>
          </Link>
          <Link className={`${styles.villaStory} ${styles.storyOffset}`} href="/villa-destan">
            <div className={styles.storyImage}><img src={MEDIA.destanHero} alt="Villa Destan Patara Kaş özel havuz ve bahçe görünümü" loading="lazy" /><span>Destan&apos;ı keşfet ↗</span></div>
            <div className={styles.storyMeta}><div><small>VILLA 02</small><h3>Villa Destan</h3></div><p>Özel havuzu ve güçlü yaşam alanlarıyla mahremiyet odaklı bir kaçış.</p></div>
          </Link>
        </div>
      </section>

      <section className={styles.experience} id="deneyim">
        <div className={styles.experiencePhoto}><img src={MEDIA.destanSuite} alt="Villa Destan yatak odası, jakuzi ve iç mekân" loading="lazy" /></div>
        <div className={styles.experienceCopy}><span className={styles.kicker}>DOĞRUDAN KONAKLAMA</span><h2>Arada kimse yok.<br />Tatiliniz bize emanet.</h2><p>Rezervasyon takvimi, dönemsel fiyatlar ve villa bilgileri aynı yönetim altyapısından gelir. Böylece gördüğünüz bilgiyle bizim gördüğümüz bilgi aynı kalır.</p><div className={styles.points}><div><b>01</b><span>Canlı müsaitlik</span></div><div><b>02</b><span>Doğrudan iletişim</span></div><div><b>03</b><span>Şeffaf fiyat</span></div></div></div>
      </section>

      <section className={styles.homeLocation} id="konum">
        <span className={styles.kicker}>KONUM</span>
        <h2>İki villa, Patara’nın kalbinde.</h2>
        <div className={styles.homeLocationGrid}>
          {(["villa-safira", "villa-destan"] as const).map((slug) => {
            const villa = VILLAS[slug];
            const mapsUrl = locations[villa.villa];
            if (!mapsUrl) return null;
            return (
              <a key={slug} className={styles.homeLocationCard} href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <small>{villa.address.addressLocality} · {villa.address.addressRegion}</small>
                <h3>{villa.name}</h3>
                <p>{villa.address.streetAddress}</p>
                <em>Haritada Gör →</em>
              </a>
            );
          })}
        </div>
      </section>

      <section className={styles.locationBlock}>
        <span className={styles.kicker}>{REGION_INFO.kicker}</span>
        <h2>{REGION_INFO.title}</h2>
        <p>{REGION_INFO.body}</p>
        <a href="#iletisim">Rezervasyon hakkında konuşalım →</a>
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

      <footer className={styles.footer} id="iletisim">
        <div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div>
        <div className={styles.footerGrid}>
          <div>
            <small>KONUM</small>
            <p>
              Patara · Kaş · Antalya<br />
              {locations.Safira && <a href={locations.Safira} rel="noopener noreferrer" target="_blank">Villa Safira konumu</a>}
              {locations.Safira && locations.Destan && <br />}
              {locations.Destan && <a href={locations.Destan} rel="noopener noreferrer" target="_blank">Villa Destan konumu</a>}
            </p>
          </div>
          <div><small>REZERVASYON</small><p>Müsaitlik kontrolünü yukarıdaki canlı takvimden yapabilirsiniz.</p></div>
          <div>
            <small>SOSYAL</small>
            <p>
              <a href={VILLAS["villa-safira"].instagram} rel="me noopener noreferrer">Villa Safira Instagram</a><br />
              <a href={VILLAS["villa-safira"].facebook} rel="me noopener noreferrer">Villa Safira Facebook</a><br />
              <a href={VILLAS["villa-destan"].instagram} rel="me noopener noreferrer">Villa Destan Instagram</a><br />
              <a href={VILLAS["villa-destan"].facebook} rel="me noopener noreferrer">Villa Destan Facebook</a>
            </p>
          </div>
        </div>
        <div className={styles.footerBottom}>Safira & Destan Villas <span>Patara’da size ait bir tatil.</span></div>
      </footer>
    </main>
  );
}
