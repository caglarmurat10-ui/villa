import type { Metadata } from "next";
import Link from "next/link";
import { VILLAS } from "@/lib/villa-content";
import { POLICY_SECTIONS, POLICY_SUMMARY } from "@/lib/reservation-policy";
import CookiePreferencesButton from "@/components/analytics/CookiePreferencesButton";
import styles from "../site.module.css";

const ORIGIN = "https://safiradestan.com";
const CANONICAL = `${ORIGIN}/rezervasyon-kosullari`;

const TITLE = "Rezervasyon ve Konaklama Koşulları | Safira & Destan Villas";
const DESCRIPTION = "Villa Safira ve Villa Destan için rezervasyon ön ödemesi, iptal ve iade, hasar güvence bedeli, giriş/çıkış ve konaklama koşulları.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ReservationPolicyPage() {
  return (
    <main className={styles.page}>
      <a href="#policy-icerik" className={styles.skipLink}>İçeriğe atla</a>
      <section className={styles.policyHead}>
        <nav className={styles.nav} aria-label="Ana menü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}>
            <Link href="/">Ana sayfa</Link>
            <Link href="/villa-safira">Villa Safira</Link>
            <Link href="/villa-destan">Villa Destan</Link>
          </div>
        </nav>
        <div className={styles.policyHeadCopy} id="policy-icerik" tabIndex={-1}>
          <span className={styles.eyebrow}>SAFIRA &amp; DESTAN VILLAS</span>
          <h1 className={styles.policyTitle}>Rezervasyon ve Konaklama Koşulları</h1>
          <p className={styles.lead}>Villa Safira ve Villa Destan rezervasyonları için ön ödeme, iptal, hasar güvence bedeli ve konaklama kurallarının tamamı bu sayfada yer alır.</p>
        </div>
      </section>

      <section className={styles.policySummary}>
        <div className={styles.factChips}>
          <span className={styles.factChip}>Giriş: {POLICY_SUMMARY.entry}</span>
          <span className={styles.factChip}>Çıkış: {POLICY_SUMMARY.checkout}</span>
          <span className={styles.factChip}>Rezervasyon Ön Ödemesi: {POLICY_SUMMARY.deposit}</span>
          <span className={styles.factChip}>Hasar Güvence Bedeli: {POLICY_SUMMARY.damageDeposit}</span>
          <span className={styles.factChip}>Evcil Hayvan: {POLICY_SUMMARY.pets}</span>
          <span className={styles.factChip}>Sigara: {POLICY_SUMMARY.smoking}</span>
        </div>
      </section>

      <section className={styles.policyBody}>
        {POLICY_SECTIONS.map((section) => (
          <article className={styles.policySection} key={section.id} id={section.id}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </article>
        ))}
      </section>

      <section className={styles.policyCta}>
        <p>Rezervasyon talebi göndermeden önce bu koşulları incelemenizi rica ederiz.</p>
        <div className={styles.policyCtaLinks}>
          <Link href="/villa-safira#rezervasyon">Villa Safira için müsaitlik ara →</Link>
          <Link href="/villa-destan#rezervasyon">Villa Destan için müsaitlik ara →</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div>
        <div className={styles.footerBottom}>{VILLAS["villa-safira"].address.addressLocality} · {VILLAS["villa-safira"].address.addressRegion} <span>safiradestan.com</span><CookiePreferencesButton className={styles.footerCookieBtn} /></div>
      </footer>
    </main>
  );
}
