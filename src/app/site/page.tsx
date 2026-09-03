import type { Metadata } from "next";
import Link from "next/link";
import PublicBookingWidget from "@/components/PublicBookingWidget";
import VillaComparison from "@/components/VillaComparison";
import TrustStrip from "@/components/TrustStrip";
import ReservationConfidenceSection from "@/components/ReservationConfidenceSection";
import { getVillaLocations, listPriceRanges, listReservations } from "@/lib/db";
import { getInstallmentCampaignReadiness } from "@/lib/payments/installment-campaign";
import { VILLAS, FAQ_ITEMS, REGION_INFO, type VillaSlug } from "@/lib/villa-content";
import { GUIDE_PLACES, GUIDE_CATEGORIES } from "@/lib/region-guide";
import { toVillaId } from "@/lib/analytics";
import { listBlockedRanges } from "@/lib/ota/availability";
import CookiePreferencesButton from "@/components/analytics/CookiePreferencesButton";
import TrackedMapsLink from "@/components/analytics/TrackedMapsLink";
import TrackedSocialLink from "@/components/analytics/TrackedSocialLink";
import TrackedWhatsappLink from "@/components/analytics/TrackedWhatsappLink";
import TrackedDatesPriceLink from "@/components/analytics/TrackedDatesPriceLink";
import TrackedPhoneLink from "@/components/analytics/TrackedPhoneLink";
import { whatsappLink, WHATSAPP_PHONE_INTL, WHATSAPP_PHONE_DISPLAY_TR } from "@/lib/contact";
import styles from "./site.module.css";

export const dynamic = "force-dynamic";

const ORIGIN = "https://safiradestan.com";
const HAS_OTA_LISTINGS = Object.values(VILLAS).some((villa) => villa.airbnbListingUrl || villa.bookingListingUrl);
const GUIDE_TEASER_IDS = ["patara-antik-kenti", "patara-plaji", "kaputas-plaji", "kas-merkez"];
const GUIDE_TEASER_PLACES = GUIDE_PLACES.filter((place) => GUIDE_TEASER_IDS.includes(place.id));
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

function findGalleryImage(slug: VillaSlug, src: string) {
  const image = VILLAS[slug].gallery.find((item) => item.src === src);
  if (!image) throw new Error(`Gallery image not found: ${slug} ${src}`);
  return image;
}

const safiraHeroImage = findGalleryImage("villa-safira", "/villas/gallery/safira/safira-havuz-doga.jpg");
const destanHeroImage = findGalleryImage("villa-destan", "/villas/gallery/destan/destan-aksam-havuz.jpg");
const safiraExperienceImage = findGalleryImage("villa-safira", "/villas/gallery/safira/safira-havuz-genis-aci.jpg");
const destanExperienceImage = findGalleryImage("villa-destan", "/villas/gallery/destan/destan-gece-havuz.jpg");

function heroVariants(base: string) {
  return {
    jpgSm: `${base}-hero-sm.jpg`,
    jpgLg: `${base}-hero-lg.jpg`,
    webpSm: `${base}-hero-sm.webp`,
    webpLg: `${base}-hero-lg.webp`,
  };
}

const safiraHeroVariants = heroVariants("/villas/gallery/safira/safira-havuz-doga");
const destanHeroVariants = heroVariants("/villas/gallery/destan/destan-aksam-havuz");

const MEDIA = {
  safiraHero: safiraHeroVariants,
  safiraHeroAlt: safiraHeroImage.alt,
  destanHero: destanHeroVariants,
  destanHeroAlt: destanHeroImage.alt,
  safiraExperience: safiraExperienceImage.src,
  safiraExperienceAlt: safiraExperienceImage.alt,
  destanExperience: destanExperienceImage.src,
  destanExperienceAlt: destanExperienceImage.alt,
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
    {
      "@type": "FAQPage",
      "@id": `${ORIGIN}/#faq`,
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

export default async function PublicHomePage() {
  const [reservations, prices, locations, blockedRanges, installmentCampaign] = await Promise.all([listReservations(), listPriceRanges(), getVillaLocations(), listBlockedRanges(), getInstallmentCampaignReadiness()]);
  const bookingReservations = [
    ...reservations.map(({ villa, checkIn, checkOut }) => ({ villa, checkIn, checkOut })),
    ...blockedRanges,
  ];
  const bookingPrices = prices.map(({ villa, startDate, endDate, nightlyRate }) => ({ villa, startDate, endDate, nightlyRate }));

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <a href="#ana-icerik" className={styles.skipLink}>İçeriğe atla</a>
      <section className={styles.hero}>
        <picture>
          <source
            type="image/webp"
            srcSet={`${MEDIA.safiraHero.webpSm} 640w, ${MEDIA.safiraHero.webpLg} 1600w`}
            sizes="100vw"
          />
          <img
            className={styles.heroImage}
            src={MEDIA.safiraHero.jpgLg}
            srcSet={`${MEDIA.safiraHero.jpgSm} 640w, ${MEDIA.safiraHero.jpgLg} 1600w`}
            sizes="100vw"
            alt={MEDIA.safiraHeroAlt}
            fetchPriority="high"
          />
        </picture>
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

      <TrustStrip installmentVerified={installmentCampaign.state === "INSTALLMENT_CAMPAIGN_VERIFIED"} maxInstallment={installmentCampaign.maxInstallment} />

      <section className={styles.bookingBand} id="musaitlik">
        <div className={styles.bookingWrap}>
          <div className={styles.bookingIntro}><span className={styles.kicker}>CANLI TAKVİM</span><h2>Tatil tarihiniz<br />müsait mi?</h2><p>Takvim doğrudan yönetim sistemindeki rezervasyonlarla kontrol edilir.</p></div>
          <PublicBookingWidget reservations={bookingReservations} prices={bookingPrices} />
        </div>
      </section>

      <ReservationConfidenceSection />

      <section className={styles.section} id="villalar">
        <div className={styles.editorialHead}><span className={styles.kicker}>PATARA VİLLA KİRALAMA</span><h2>Hangisi sizin<br />tatiliniz?</h2><p>Villa Safira ve Villa Destan’ı gerçek fotoğraflarıyla keşfedin; Patara’da özel havuzlu villa tatili için size en uygun seçeneği bulun.</p></div>
        <div className={styles.villaGrid}>
          <Link className={styles.villaStory} href="/villa-safira">
            <div className={styles.storyImage}>
              <picture>
                <source type="image/webp" srcSet={`${MEDIA.safiraHero.webpSm} 640w, ${MEDIA.safiraHero.webpLg} 1600w`} sizes="(max-width: 900px) 90vw, 45vw" />
                <img src={MEDIA.safiraHero.jpgLg} srcSet={`${MEDIA.safiraHero.jpgSm} 640w, ${MEDIA.safiraHero.jpgLg} 1600w`} sizes="(max-width: 900px) 90vw, 45vw" alt={MEDIA.safiraHeroAlt} loading="lazy" />
              </picture>
              <span>Safira&apos;yı keşfet ↗</span>
            </div>
            <div className={styles.storyMeta}><div><small>VILLA 01</small><h3>Villa Safira</h3></div><p>Doğayla çevrili, ferah ve özel havuzlu bir Patara villa tatili.</p></div>
          </Link>
          <Link className={`${styles.villaStory} ${styles.storyOffset}`} href="/villa-destan">
            <div className={styles.storyImage}>
              <picture>
                <source type="image/webp" srcSet={`${MEDIA.destanHero.webpSm} 640w, ${MEDIA.destanHero.webpLg} 1600w`} sizes="(max-width: 900px) 90vw, 45vw" />
                <img src={MEDIA.destanHero.jpgLg} srcSet={`${MEDIA.destanHero.jpgSm} 640w, ${MEDIA.destanHero.jpgLg} 1600w`} sizes="(max-width: 900px) 90vw, 45vw" alt={MEDIA.destanHeroAlt} loading="lazy" />
              </picture>
              <span>Destan&apos;ı keşfet ↗</span>
            </div>
            <div className={styles.storyMeta}><div><small>VILLA 02</small><h3>Villa Destan</h3></div><p>Özel havuzu ve güçlü yaşam alanlarıyla mahremiyet odaklı bir kaçış.</p></div>
          </Link>
        </div>
        {HAS_OTA_LISTINGS && <p className={styles.otaTrustNote}>Doğrudan veya tercih ettiğiniz rezervasyon platformu üzerinden.</p>}
      </section>

      <section className={styles.experience} id="deneyim">
        <div className={styles.experiencePhoto}><img src={MEDIA.safiraExperience} alt={MEDIA.safiraExperienceAlt} loading="lazy" /></div>
        <div className={styles.experienceCopy}>
          <span className={styles.kicker}>VILLA SAFİRA</span>
          <h2>Doğayla çevrili,<br />gün ışığı dolu bir kaçış.</h2>
          <p>Çam ormanına yaslanan bahçesi ve genişleyen havuz manzarasıyla Villa Safira, günü yavaşlatan sakin ve aydınlık bir Patara tatili sunar.</p>
          <Link className={styles.experienceLink} href="/villa-safira">Villa Safira’yı keşfet →</Link>
        </div>
      </section>

      <section className={`${styles.experience} ${styles.experienceReverse}`}>
        <div className={styles.experienceCopy}>
          <span className={styles.kicker}>VILLA DESTAN</span>
          <h2>Akşamlar için tasarlanmış,<br />karakterli bir mekân.</h2>
          <p>İki katlı mimarisi ve havuzundaki akşam atmosferiyle Villa Destan, gün batımından sonra da özenle devam eden bir konaklama deneyimi sunar.</p>
          <Link className={styles.experienceLink} href="/villa-destan">Villa Destan’ı keşfet →</Link>
        </div>
        <div className={styles.experiencePhoto}><img src={MEDIA.destanExperience} alt={MEDIA.destanExperienceAlt} loading="lazy" /></div>
      </section>

      <VillaComparison />

      <section className={styles.homeLocation} id="konum">
        <span className={styles.kicker}>KONUM</span>
        <h2>İki villa, Patara’nın kalbinde.</h2>
        <div className={styles.homeLocationGrid}>
          {(["villa-safira", "villa-destan"] as const).map((slug) => {
            const villa = VILLAS[slug];
            const mapsUrl = locations[villa.villa];
            if (!mapsUrl) return null;
            return (
              <TrackedMapsLink
                key={slug}
                className={styles.homeLocationCard}
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                villaId={toVillaId(villa.villa)}
                villaName={villa.name}
                ctaLocation="home_location_card"
                mapAction="open_maps"
              >
                <div className={styles.homeLocationPhoto}><img src={villa.cover} alt={villa.coverAlt} loading="lazy" /></div>
                <div className={styles.homeLocationBody}>
                  <small>{villa.address.addressLocality} · {villa.address.addressRegion}</small>
                  <h3>{villa.name}</h3>
                  <p>{villa.address.streetAddress}</p>
                  <em>Haritada Gör →</em>
                </div>
              </TrackedMapsLink>
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

      <section className={styles.section} id="rehber">
        <div className={styles.editorialHead}><span className={styles.kicker}>BÖLGEYİ KEŞFET</span><h2>Patara &amp;<br />Kaş rehberi</h2><p>Villa Safira ve Villa Destan çevresinde tarih, deniz ve doğa dolu gerçek gezi noktaları.</p></div>
        <div className={styles.guideTeaserGrid}>
          {GUIDE_TEASER_PLACES.map((place) => (
            <div className={styles.guideTeaserCard} key={place.id}>
              <span className={styles.kicker}>{GUIDE_CATEGORIES.find((c) => c.slug === place.category)?.label}</span>
              <h3>{place.name}</h3>
              <p>{place.description}</p>
            </div>
          ))}
        </div>
        <Link className={styles.experienceLink} href="/rehber">Tüm bölge rehberini incele →</Link>
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
            <small>İLETİŞİM</small>
            <p>
              <TrackedWhatsappLink href={whatsappLink("Merhaba, Villa Safira ve Villa Destan hakkında bilgi almak istiyorum.")} target="_blank" rel="noopener noreferrer" ctaLocation="homepage_footer">WhatsApp'tan yazın</TrackedWhatsappLink><br />
              <TrackedPhoneLink href={`tel:+${WHATSAPP_PHONE_INTL}`} ctaLocation="homepage_footer">{WHATSAPP_PHONE_DISPLAY_TR}</TrackedPhoneLink>
            </p>
          </div>
          <div>
            <small>KONUM</small>
            <p>
              Patara · Kaş · Antalya<br />
              {locations.Safira && <a href={locations.Safira} rel="noopener noreferrer" target="_blank">Villa Safira konumu</a>}
              {locations.Safira && locations.Destan && <br />}
              {locations.Destan && <a href={locations.Destan} rel="noopener noreferrer" target="_blank">Villa Destan konumu</a>}
            </p>
          </div>
          <div><small>REZERVASYON</small><p>Müsaitlik kontrolünü yukarıdaki canlı takvimden yapabilirsiniz.<br /><Link href="/rezervasyon-kosullari">Rezervasyon ve Konaklama Koşulları</Link></p></div>
          <div>
            <small>SOSYAL</small>
            <p>
              <TrackedSocialLink platform="instagram" villaId="safira" ctaLocation="homepage_footer" href={VILLAS["villa-safira"].instagram} rel="me noopener noreferrer">Villa Safira Instagram</TrackedSocialLink><br />
              <TrackedSocialLink platform="facebook" villaId="safira" ctaLocation="homepage_footer" href={VILLAS["villa-safira"].facebook} rel="me noopener noreferrer">Villa Safira Facebook</TrackedSocialLink><br />
              <TrackedSocialLink platform="instagram" villaId="destan" ctaLocation="homepage_footer" href={VILLAS["villa-destan"].instagram} rel="me noopener noreferrer">Villa Destan Instagram</TrackedSocialLink><br />
              <TrackedSocialLink platform="facebook" villaId="destan" ctaLocation="homepage_footer" href={VILLAS["villa-destan"].facebook} rel="me noopener noreferrer">Villa Destan Facebook</TrackedSocialLink>
            </p>
          </div>
        </div>
        <div className={styles.footerBottom}>
          Safira & Destan Villas <span>Patara’da size ait bir tatil.</span>
          <CookiePreferencesButton className={styles.footerCookieBtn} />
        </div>
      </footer>

      <div className={styles.stickyCta}>
        <TrackedDatesPriceLink href="#musaitlik" ctaLocation="home_sticky_cta">Tarih &amp; Fiyat</TrackedDatesPriceLink>
        <TrackedWhatsappLink className={styles.stickyCtaWhatsapp} href={whatsappLink("Merhaba, Villa Safira ve Villa Destan hakkında bilgi almak istiyorum.")} target="_blank" rel="noopener noreferrer" ctaLocation="home_sticky_cta">WhatsApp</TrackedWhatsappLink>
      </div>
    </main>
  );
}
