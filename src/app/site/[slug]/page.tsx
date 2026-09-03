import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicBookingWidget from "@/components/PublicBookingWidget";
import SeasonalPricingTable from "@/components/SeasonalPricingTable";
import VillaGalleryLightbox from "@/components/VillaGalleryLightbox";
import { getVillaLocations, listPriceRanges, listReservations } from "@/lib/db";
import { VILLAS, FAQ_ITEMS, REGION_INFO, formatAddress, type VillaSlug } from "@/lib/villa-content";
import { POLICY_SUMMARY } from "@/lib/reservation-policy";
import { fetchGoogleReviews } from "@/lib/google-reviews";
import { toVillaId } from "@/lib/analytics";
import ViewItemTracker from "@/components/analytics/ViewItemTracker";
import TrackedMapsLink from "@/components/analytics/TrackedMapsLink";
import TrackedOtaLink from "@/components/analytics/TrackedOtaLink";
import TrackedSocialLink from "@/components/analytics/TrackedSocialLink";
import TrackedWhatsappLink from "@/components/analytics/TrackedWhatsappLink";
import { whatsappLink, WHATSAPP_PHONE_DISPLAY_INTL } from "@/lib/contact";
import CookiePreferencesButton from "@/components/analytics/CookiePreferencesButton";
import { listBlockedRanges } from "@/lib/ota/availability";
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
  const [reservations, prices, locations, googleReviews, blockedRanges] = await Promise.all([listReservations(), listPriceRanges(), getVillaLocations(), fetchGoogleReviews(villa.villa), listBlockedRanges()]);
  const bookingReservations = [
    ...reservations.map(({ villa: itemVilla, checkIn, checkOut }) => ({ villa: itemVilla, checkIn, checkOut })),
    ...blockedRanges,
  ];
  const bookingPrices = prices.map(({ villa: itemVilla, startDate, endDate, nightlyRate }) => ({ villa: itemVilla, startDate, endDate, nightlyRate }));
  const todayIso = new Date().toISOString().slice(0, 10);
  const mapsUrl = locations[villa.villa];
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${villa.geo.lat},${villa.geo.lng}`;
  // Yalnız GERÇEKTEN mevcut olan OTA butonlarını isimlendirir - Booking public URL'si yokken metin
  // "Airbnb ya da Booking.com" demez (tıklanamayan bir seçenek vaat etmemek için).
  const otaPlatformNames = [villa.airbnbListingUrl ? "Airbnb" : null, villa.bookingListingUrl ? "Booking.com" : null].filter((name): name is string => Boolean(name));
  const otaPlatformNamesText = otaPlatformNames.length === 2 ? `${otaPlatformNames[0]} ya da ${otaPlatformNames[1]}` : otaPlatformNames[0];
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
        telephone: WHATSAPP_PHONE_DISPLAY_INTL,
        containsPlace: {
          "@type": "Accommodation",
          numberOfBedrooms: villa.quickFacts.bedroomCount,
          occupancy: {
            "@type": "QuantitativeValue",
            value: villa.quickFacts.maxGuests,
          },
        },
        amenityFeature: [
          { "@type": "LocationFeatureSpecification", name: "Özel havuz", value: true },
          { "@type": "LocationFeatureSpecification", name: "Doğrudan rezervasyon", value: true },
          { "@type": "LocationFeatureSpecification", name: "Canlı müsaitlik", value: true },
          ...villa.highlights
            .filter((item) => item.title !== "Özel havuz")
            .map((item) => ({ "@type": "LocationFeatureSpecification", name: item.title, value: true })),
        ],
        sameAs: [villa.instagram, villa.facebook, villa.airbnbListingUrl, mapsUrl].filter((url): url is string => Boolean(url)),
        ...(googleReviews && googleReviews.reviews.length > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: googleReviews.rating,
                reviewCount: googleReviews.userRatingCount,
              },
              review: googleReviews.reviews.map((review) => ({
                "@type": "Review",
                reviewRating: { "@type": "Rating", ratingValue: review.rating },
                author: { "@type": "Person", name: review.author.displayName },
                reviewBody: review.text,
                datePublished: review.publishTime || undefined,
              })),
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana sayfa", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: villa.name, item: canonical },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <ViewItemTracker villaId={toVillaId(villa.villa)} villaName={villa.name} />
      <a href="#ana-icerik" className={styles.skipLink}>İçeriğe atla</a>
      <section className={`${styles.hero} ${styles.detailHero}`}>
        <img className={styles.heroImage} src={villa.cover} alt={villa.coverAlt} fetchPriority="high" />
        <div className={styles.heroShade} />
        <nav className={styles.nav} aria-label="Villa menüsü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}><Link href="/">Ana sayfa</Link><a href="#galeri">Villa</a><a href="#donemsel-fiyatlar">Fiyatlar</a><a href="#konum">Konum</a><a href="#sss">SSS</a><a className={styles.cta} href="#rezervasyon">Müsaitlik</a></div>
        </nav>
        <div className={styles.detailHeroCopy} id="ana-icerik" tabIndex={-1}>
          <span className={styles.eyebrow}>{villa.label} · PATARA · KAŞ</span>
          <h1 className={styles.title}>{villa.name}</h1>
          <p className={styles.lead}>{villa.description}</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <a className={styles.primary} href="#rezervasyon">Tarih kontrol et</a>
            <TrackedWhatsappLink className={styles.secondary} href={whatsappLink(villa.whatsappMessage)} target="_blank" rel="noopener noreferrer" villaId={toVillaId(villa.villa)} villaName={villa.name} ctaLocation="villa_hero">WhatsApp'tan Yaz</TrackedWhatsappLink>
          </div>
        </div>
      </section>

      <section className={styles.detailIntro}>
        <div><span className={styles.kicker}>PATARA ÖZEL HAVUZLU VİLLA</span><h2>{villa.quote}</h2></div>
        <p>Burada tatilin merkezi villanın kendisi. Sabahınızı özel havuz başında başlatın, Patara ve Kaş’ı kendi temponuzda keşfedin, günün sonunda tekrar tamamen size ait olan alana dönün.</p>
      </section>

      <section className={styles.quickFacts}>
        <span className={styles.kicker}>VILLA ÖZELLİKLERİ</span>
        <div className={styles.factChips}>
          {villa.quickFacts.chips.map((chip) => (
            <span className={styles.factChip} key={chip}>{chip}</span>
          ))}
        </div>
        <p>{villa.quickFacts.summary}</p>
      </section>

      <section className={styles.gallery} id="galeri">
        <figure className={styles.galleryMain}><img src={villa.cover} alt={villa.coverAlt} loading="eager" /></figure>
        <figure className={styles.gallerySide}>
          <picture>
            <source
              type="image/webp"
              srcSet={`${villa.secondary.replace(/\.jpg$/, "-hero-sm.webp")} 640w, ${villa.secondary.replace(/\.jpg$/, "-hero-lg.webp")} 1600w`}
              sizes="(max-width: 900px) 90vw, 32vw"
            />
            <img
              src={villa.secondary.replace(/\.jpg$/, "-hero-lg.jpg")}
              srcSet={`${villa.secondary.replace(/\.jpg$/, "-hero-sm.jpg")} 640w, ${villa.secondary.replace(/\.jpg$/, "-hero-lg.jpg")} 1600w`}
              sizes="(max-width: 900px) 90vw, 32vw"
              alt={villa.secondaryAlt}
              loading="lazy"
            />
          </picture>
        </figure>
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
        <VillaGalleryLightbox images={villa.gallery} villaName={villa.name} villaId={toVillaId(villa.villa)} />
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
              {mapsUrl && (
                <TrackedMapsLink
                  className={styles.locationActionPrimary}
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  villaId={toVillaId(villa.villa)}
                  villaName={villa.name}
                  ctaLocation="villa_location_card"
                  mapAction="open_maps"
                >
                  Google Maps’te Aç
                </TrackedMapsLink>
              )}
              <TrackedMapsLink
                className={styles.locationActionSecondary}
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                villaId={toVillaId(villa.villa)}
                villaName={villa.name}
                ctaLocation="villa_location_card"
                mapAction="directions"
              >
                Yol Tarifi Al
              </TrackedMapsLink>
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

      <section className={styles.quickFacts}>
        <span className={styles.kicker}>KONAKLAMA KURALLARI</span>
        <div className={styles.factChips}>
          <span className={styles.factChip}>Giriş: {POLICY_SUMMARY.entry}</span>
          <span className={styles.factChip}>Çıkış: {POLICY_SUMMARY.checkout}</span>
          <span className={styles.factChip}>Rezervasyon Ön Ödemesi: {POLICY_SUMMARY.deposit}</span>
          <span className={styles.factChip}>Hasar Güvence Bedeli: {POLICY_SUMMARY.damageDeposit}</span>
          <span className={styles.factChip}>Evcil Hayvan: {POLICY_SUMMARY.pets}</span>
          <span className={styles.factChip}>Sigara: {POLICY_SUMMARY.smoking}</span>
        </div>
        <Link className={styles.experienceLink} href="/rezervasyon-kosullari">Rezervasyon ve Konaklama Koşullarını İncele →</Link>
        <Link className={styles.experienceLink} href="/#hava-durumu">Patara’da Şu An: Yerel Hava Durumu →</Link>
      </section>

      {googleReviews && googleReviews.reviews.length > 0 && (
        <section className={styles.reviewsSection}>
          <span className={styles.kicker}>MİSAFİRLER NE DİYOR?</span>
          <div className={styles.reviewsHead}>
            <strong>{googleReviews.rating.toFixed(1)}</strong>
            <div>
              <span>Google puanı</span>
              <span>{googleReviews.userRatingCount} yorum</span>
            </div>
          </div>
          <div className={styles.reviewsGrid}>
            {googleReviews.reviews.map((review, index) => (
              <article className={styles.reviewCard} key={index}>
                <p>&ldquo;{review.text}&rdquo;</p>
                <div className={styles.reviewAuthor}>
                  <span>{review.author.displayName}</span>
                  {review.relativeDescription && <small>{review.relativeDescription}</small>}
                </div>
              </article>
            ))}
          </div>
          <a className={styles.experienceLink} href={googleReviews.googleMapsUri} target="_blank" rel="noopener noreferrer">Google Maps&apos;te Tüm Yorumları Gör →</a>
        </section>
      )}

      {(villa.airbnbListingUrl || villa.bookingListingUrl) && (
        <section className={styles.reservationOptions}>
          <span className={styles.kicker}>REZERVASYON SEÇENEKLERİ</span>
          <h2>Size uygun rezervasyon yöntemini seçin.</h2>
          <p>Doğrudan müsaitlik talebi gönderebilir veya rezervasyonunuzu {otaPlatformNamesText} üzerinden tamamlayabilirsiniz.</p>
          <div className={styles.reservationOptionButtons}>
            <a className={styles.locationActionPrimary} href="#rezervasyon">Müsaitlik Talebi Gönder</a>
            {villa.airbnbListingUrl && (
              <TrackedOtaLink
                className={styles.locationActionSecondary}
                href={villa.airbnbListingUrl}
                target="_blank"
                rel="noopener noreferrer"
                channel="airbnb"
                villaId={toVillaId(villa.villa)}
                villaName={villa.name}
                ctaLocation="reservation_options"
              >
                Airbnb&apos;de Rezervasyon Yap
              </TrackedOtaLink>
            )}
            {villa.bookingListingUrl && (
              <TrackedOtaLink
                className={styles.locationActionSecondary}
                href={villa.bookingListingUrl}
                target="_blank"
                rel="noopener noreferrer"
                channel="booking"
                villaId={toVillaId(villa.villa)}
                villaName={villa.name}
                ctaLocation="reservation_options"
              >
                Booking.com&apos;da Rezervasyon Yap
              </TrackedOtaLink>
            )}
          </div>
          <p className={styles.reservationOptionsNote}>{otaPlatformNames.join(" ve ")} üzerinden yapılan rezervasyonlarda ödeme ve rezervasyon işlemleri ilgili platformun koşullarına tabidir.</p>
        </section>
      )}

      <SeasonalPricingTable villa={villa.villa} prices={bookingPrices} todayIso={todayIso} />

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
        <Link href="/rehber/patara">Patara rehberini keşfet →</Link>
        <Link href="/rehber/patara-plaji">Patara Plajı hakkında →</Link>
        <Link href="/rehber">Tüm bölge rehberini keşfet →</Link>
        <div className={styles.socialRow}>
          <TrackedSocialLink platform="instagram" villaId={toVillaId(villa.villa)} ctaLocation="villa_page_social_row" href={villa.instagram} rel="me noopener noreferrer">{villa.name} Instagram →</TrackedSocialLink>
          <TrackedSocialLink platform="facebook" villaId={toVillaId(villa.villa)} ctaLocation="villa_page_social_row" href={villa.facebook} rel="me noopener noreferrer">{villa.name} Facebook →</TrackedSocialLink>
        </div>
      </section>

      <footer className={styles.footer}><div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div><div className={styles.footerBottom}><span>Patara · Kaş · Antalya · <Link href="/rezervasyon-kosullari">Rezervasyon ve Konaklama Koşulları</Link></span><span>safiradestan.com</span><CookiePreferencesButton className={styles.footerCookieBtn} /></div></footer>

      <div className={styles.stickyCta}>
        <a href="#rezervasyon">Tarih kontrol et</a>
        <TrackedWhatsappLink href={whatsappLink(villa.whatsappMessage)} target="_blank" rel="noopener noreferrer" villaId={toVillaId(villa.villa)} villaName={villa.name} ctaLocation="villa_sticky_cta">WhatsApp</TrackedWhatsappLink>
      </div>
    </main>
  );
}
