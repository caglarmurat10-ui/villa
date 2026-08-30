import Link from "next/link";
import styles from "./site.module.css";

export default function PublicHomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <nav className={styles.nav} aria-label="Ana menü">
          <div className={styles.brand}>SAFIRA & DESTAN VILLAS</div>
          <div className={styles.navlinks}>
            <a href="#villalar">Villalar</a>
            <a href="#deneyim">Deneyim</a>
            <a href="#iletisim" className={styles.cta}>İletişim</a>
          </div>
        </nav>

        <div className={styles.heroInner}>
          <div>
            <div className={styles.eyebrow}>Patara · Kaş · Antalya</div>
            <h1 className={styles.title}>Akdeniz’de size özel bir kaçış.</h1>
            <p className={styles.lead}>
              Villa Safira ve Villa Destan’ı tek çatı altında keşfedin. Müsaitlik, fiyat ve rezervasyon sürecini doğrudan yönetin.
            </p>
            <div className={styles.actions}>
              <a className={styles.primary} href="#villalar">Villaları keşfet</a>
              <a className={styles.secondary} href="#iletisim">Rezervasyon bilgisi</a>
            </div>
          </div>
          <div className={styles.heroArt} aria-label="Villa Safira ve Villa Destan">
            <img src="/brand/safira-facebook-cover.svg" alt="Villa Safira" />
            <img src="/brand/destan-facebook-cover.svg" alt="Villa Destan" />
          </div>
        </div>
      </section>

      <section className={styles.section} id="villalar">
        <div className={styles.sectionHead}>
          <h2>İki villa, tek deneyim.</h2>
          <p>Her villa için ayrı tanıtım, müsaitlik ve rezervasyon akışı olacak. Yönetim panelindeki verilerle doğrudan bağlantılı çalışacak.</p>
        </div>
        <div className={styles.cards}>
          <article className={styles.card}>
            <img src="/brand/safira-facebook-cover.svg" alt="Villa Safira tanıtımı" />
            <div className={styles.cardBody}>
              <h3>Villa Safira</h3>
              <p>Sade, özel ve huzurlu bir tatil deneyimi için tasarlanmış Villa Safira’yı ayrıntılarıyla inceleyin.</p>
              <Link href="/villa-safira">Villa Safira’yı incele →</Link>
            </div>
          </article>
          <article className={styles.card}>
            <img src="/brand/destan-facebook-cover.svg" alt="Villa Destan tanıtımı" />
            <div className={styles.cardBody}>
              <h3>Villa Destan</h3>
              <p>Akdeniz tatilini özel villa konforuyla birleştiren Villa Destan’ın ayrıntılarını keşfedin.</p>
              <Link href="/villa-destan">Villa Destan’ı incele →</Link>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.strip} id="deneyim">
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Doğrudan ve kolay.</h2>
            <p>Siteyi yalnızca vitrin olarak değil, rezervasyon sisteminin müşteri tarafı olarak kuruyoruz.</p>
          </div>
          <div className={styles.features}>
            <div className={styles.feature}><img src="/brand/highlight-musaitlik.svg" alt="" /><strong>Canlı müsaitlik</strong><span>Rezervasyon programıyla aynı takvim.</span></div>
            <div className={styles.feature}><img src="/brand/highlight-villa.svg" alt="" /><strong>Villa detayları</strong><span>Her villa için ayrı, güçlü tanıtım sayfası.</span></div>
            <div className={styles.feature}><img src="/brand/highlight-patara.svg" alt="" /><strong>Patara & Kaş</strong><span>Bölgeyi ve tatil deneyimini birlikte anlatan içerik.</span></div>
            <div className={styles.feature}><img src="/brand/highlight-iletisim.svg" alt="" /><strong>Doğrudan iletişim</strong><span>WhatsApp ve rezervasyon talebi akışı.</span></div>
          </div>
        </div>
      </section>

      <footer className={styles.footer} id="iletisim">
        <div className={styles.footerInner}>
          <div><strong>Safira & Destan Villas</strong><p>Patara · Kaş · Antalya</p></div>
          <div><p>Doğrudan rezervasyon altyapısı hazırlanıyor.</p></div>
        </div>
      </footer>
    </main>
  );
}
