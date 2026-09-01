import type { Metadata } from "next";
import Link from "next/link";
import { VILLAS } from "@/lib/villa-content";
import RegionGuideGrid from "@/components/RegionGuideGrid";
import CookiePreferencesButton from "@/components/analytics/CookiePreferencesButton";
import styles from "../site.module.css";

const ORIGIN = "https://safiradestan.com";
const CANONICAL = `${ORIGIN}/rehber`;

export const metadata: Metadata = {
  title: "Patara & Kaş Bölge Rehberi | Safira & Destan Villas",
  description: "Patara Antik Kenti, Patara Plajı, Kaputaş Plajı, Xanthos, Saklıkent Kanyonu, Kaş ve Kalkan — Villa Safira ve Villa Destan çevresinde gezilecek gerçek yerler.",
  alternates: { canonical: CANONICAL },
  robots: { index: true, follow: true },
};

export default function RegionGuidePage() {
  return (
    <main className={styles.page}>
      <a href="#rehber-icerik" className={styles.skipLink}>İçeriğe atla</a>
      <section className={styles.policyHead}>
        <nav className={styles.nav} aria-label="Ana menü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}>
            <Link href="/">Ana sayfa</Link>
            <Link href="/villa-safira">Villa Safira</Link>
            <Link href="/villa-destan">Villa Destan</Link>
          </div>
        </nav>
        <div className={styles.policyHeadCopy} id="rehber-icerik" tabIndex={-1}>
          <span className={styles.eyebrow}>PATARA · KAŞ · ANTALYA</span>
          <h1 className={styles.policyTitle}>Patara &amp; Kaş Bölge Rehberi</h1>
          <p className={styles.lead}>Villa Safira ve Villa Destan'ın bulunduğu Patara/Gelemiş çevresinde tarih, deniz ve doğa dolu gerçek gezi noktaları.</p>
        </div>
      </section>

      <section className={styles.policyBody}>
        <RegionGuideGrid />
      </section>

      <section className={styles.policyCta}>
        <p>Tatilinizi planlarken villa seçiminize de göz atın.</p>
        <div className={styles.policyCtaLinks}>
          <Link href="/villa-safira">Villa Safira'yı keşfet →</Link>
          <Link href="/villa-destan">Villa Destan'ı keşfet →</Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div>
        <div className={styles.footerBottom}><span>{VILLAS["villa-safira"].address.addressLocality} · {VILLAS["villa-safira"].address.addressRegion}</span><span>safiradestan.com</span><CookiePreferencesButton className={styles.footerCookieBtn} /></div>
      </footer>
    </main>
  );
}
