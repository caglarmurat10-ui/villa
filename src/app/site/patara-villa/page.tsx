import type { Metadata } from "next";
import Link from "next/link";
import VillaComparison from "@/components/VillaComparison";
import CookiePreferencesButton from "@/components/analytics/CookiePreferencesButton";
import TrackedWhatsappLink from "@/components/analytics/TrackedWhatsappLink";
import TrackedSocialLink from "@/components/analytics/TrackedSocialLink";
import { VILLAS, REGION_INFO } from "@/lib/villa-content";
import { toVillaId } from "@/lib/analytics";
import { whatsappLink, WHATSAPP_PHONE_DISPLAY_TR } from "@/lib/contact";
import { hreflangAlternates } from "@/lib/seo";
import {
  PATARA_VILLA_CANONICAL,
  PATARA_VILLA_FAQ,
  buildPataraVillaMetadata,
  buildPataraVillaStructuredData,
} from "@/lib/patara-villa-content";
import styles from "../site.module.css";

export const metadata: Metadata = {
  ...buildPataraVillaMetadata(),
  alternates: hreflangAlternates(PATARA_VILLA_CANONICAL),
  robots: { index: true, follow: true },
};

export default function PataraVillaHubPage() {
  const structuredData = buildPataraVillaStructuredData();

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <a href="#ana-icerik" className={styles.skipLink}>İçeriğe atla</a>

      <section className={styles.locationBlock} id="ana-icerik" tabIndex={-1}>
        <span className={styles.kicker}>PATARA KİRALIK VİLLA</span>
        <h1>Patara&apos;da özel havuzlu villa: Safira &amp; Destan.</h1>
        <p>
          Patara/Gelemiş Mahallesi&apos;nde iki ayrı özel havuzlu villa: Villa Safira ve Villa Destan.
          İkisi de doğrudan rezervasyona açık, canlı müsaitlik ve dönemsel net fiyatla — aracı
          komisyonu olmadan.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <a className={styles.primary} href="#karsilastir">Villaları karşılaştır</a>
          <TrackedWhatsappLink
            className={styles.secondary}
            href={whatsappLink("Merhaba, Patara'da kiralık villa hakkında bilgi almak istiyorum.")}
            target="_blank"
            rel="noopener noreferrer"
            ctaLocation="patara_villa_hero"
          >
            WhatsApp&apos;tan Sor
          </TrackedWhatsappLink>
        </div>
      </section>

      <VillaComparison />

      <section className={styles.section}>
        <div className={styles.editorialHead}>
          <span className={styles.kicker}>NEDEN PATARA</span>
          <h2>Patara&apos;da villa tatili neden farklı?</h2>
          <p>{REGION_INFO.body}</p>
        </div>
        <p style={{ maxWidth: 720 }}>
          Her iki villa da Gelemiş Mahallesi&apos;nde, Patara Antik Kenti ve Patara Plajı&apos;na yakın
          konumda yer alır. Bölgeyi tarih, sahil ve doğa yönleriyle keşfetmek isteyenler için{" "}
          <Link href="/rehber/patara" className={styles.experienceLink}>Patara bölge rehberimizi</Link> inceleyebilirsiniz.
        </p>
      </section>

      <section className={styles.highlights}>
        <span className={styles.kicker}>PATARA &amp; KAŞ REHBERİ</span>
        <h2>Tatil planınızı bölge rehberleriyle tamamlayın.</h2>
        <div className={styles.highlightGrid}>
          <Link href="/rehber/patara" className={styles.highlightCard}>
            <h3>Patara gezi rehberi</h3>
            <p>Patara&apos;yı tarih, sahil ve çevre deneyimiyle birlikte keşfedin.</p>
          </Link>
          <Link href="/rehber/patara-plaji" className={styles.highlightCard}>
            <h3>Patara Plajı rehberi</h3>
            <p>Patara Plajı için hazırlanan doğrulanmış bölge içeriğini inceleyin.</p>
          </Link>
          <Link href="/rehber/patara-antik-kenti" className={styles.highlightCard}>
            <h3>Patara Antik Kenti rehberi</h3>
            <p>Patara&apos;nın tarihî odağını ayrı rehber sayfasında keşfedin.</p>
          </Link>
          <Link href="/rehber/kas" className={styles.highlightCard}>
            <h3>Kaş gezi rehberi</h3>
            <p>Kaş çevresini planınıza eklemek için bölge rehberine göz atın.</p>
          </Link>
          <Link href="/rehber/kalkan" className={styles.highlightCard}>
            <h3>Kalkan gezi rehberi</h3>
            <p>Kalkan&apos;ı keşfetmek için hazırlanan rehber içeriğini inceleyin.</p>
          </Link>
        </div>
      </section>

      <section className={styles.faq} id="sss">
        <span className={styles.kicker}>SIK SORULAN SORULAR</span>
        <h2>Patara kiralık villa hakkında merak edilenler</h2>
        {PATARA_VILLA_FAQ.map((item) => (
          <details className={styles.faqItem} key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </section>

      <section className={styles.nextVilla}>
        <span className={styles.kicker}>DOĞRUDAN KEŞFEDİN</span>
        <h2>Villa detayına geçin.</h2>
        <Link href="/villa-safira">Villa Safira&apos;yı keşfet →</Link>
        <Link href="/villa-destan">Villa Destan&apos;ı keşfet →</Link>
        <Link href="/rehber/patara">Patara rehberini keşfet →</Link>
        <div className={styles.socialRow}>
          <TrackedSocialLink platform="instagram" villaId={toVillaId("Safira")} ctaLocation="patara_villa_page_social_row" href={VILLAS["villa-safira"].instagram} rel="me noopener noreferrer">Villa Safira Instagram →</TrackedSocialLink>
          <TrackedSocialLink platform="instagram" villaId={toVillaId("Destan")} ctaLocation="patara_villa_page_social_row" href={VILLAS["villa-destan"].instagram} rel="me noopener noreferrer">Villa Destan Instagram →</TrackedSocialLink>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><span>SAFIRA</span><i>&amp;</i><span>DESTAN</span></div>
        <div className={styles.footerBottom}>
          <span>Patara · Kaş · Antalya · WhatsApp: {WHATSAPP_PHONE_DISPLAY_TR}</span>
          <span>safiradestan.com</span>
          <CookiePreferencesButton className={styles.footerCookieBtn} />
        </div>
      </footer>
    </main>
  );
}
