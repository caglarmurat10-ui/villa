import Link from "next/link";
import { notFound } from "next/navigation";
import styles from "../site.module.css";

const villas = {
  "villa-safira": {
    name: "Villa Safira",
    cover: "/brand/safira-facebook-cover.svg",
    description: "Patara ve Kaş çevresinde özel villa tatili arayan misafirler için sakin, bağımsız ve doğrudan rezervasyon odaklı bir konaklama deneyimi.",
  },
  "villa-destan": {
    name: "Villa Destan",
    cover: "/brand/destan-facebook-cover.svg",
    description: "Akdeniz’in sakin atmosferini özel villa konforuyla birleştiren, doğrudan iletişim ve kolay rezervasyon süreci sunan bir konaklama seçeneği.",
  },
} as const;

type VillaSlug = keyof typeof villas;

export default async function VillaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in villas)) notFound();

  const villa = villas[slug as VillaSlug];

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <nav className={styles.nav} aria-label="Villa menüsü">
          <Link className={styles.brand} href="/">SAFIRA & DESTAN VILLAS</Link>
          <div className={styles.navlinks}><Link href="/">Ana sayfa</Link><a className={styles.cta} href="#rezervasyon">Rezervasyon</a></div>
        </nav>
        <div className={styles.heroInner}>
          <div>
            <div className={styles.eyebrow}>Patara · Kaş · Antalya</div>
            <h1 className={styles.title}>{villa.name}</h1>
            <p className={styles.lead}>{villa.description}</p>
            <div className={styles.actions}><a className={styles.primary} href="#rezervasyon">Müsaitlik ve rezervasyon</a><Link className={styles.secondary} href="/">Diğer villayı gör</Link></div>
          </div>
          <div className={styles.heroArt}><img src={villa.cover} alt={villa.name} /><img src={villa.cover} alt="" /></div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>{villa.name} deneyimi</h2>
          <p>Bu sayfaya gerçek villa fotoğrafları, oda/yatak bilgileri, havuz özellikleri, konum, fiyat ve canlı müsaitlik takvimi bağlanacak.</p>
        </div>
        <div className={styles.features}>
          <div className={styles.feature}><img src="/brand/highlight-odalar.svg" alt="" /><strong>Konaklama detayları</strong><span>Oda, yatak ve kapasite bilgileri.</span></div>
          <div className={styles.feature}><img src="/brand/highlight-havuz.svg" alt="" /><strong>Villa özellikleri</strong><span>Havuz ve diğer olanakların ayrıntılı sunumu.</span></div>
          <div className={styles.feature}><img src="/brand/highlight-musaitlik.svg" alt="" /><strong>Canlı takvim</strong><span>Yönetim panelindeki rezervasyonlarla eş zamanlı.</span></div>
          <div className={styles.feature}><img src="/brand/highlight-iletisim.svg" alt="" /><strong>Doğrudan rezervasyon</strong><span>Aracısız talep ve WhatsApp iletişimi.</span></div>
        </div>
      </section>

      <section className={styles.strip} id="rezervasyon">
        <div className={styles.section}>
          <div className={styles.sectionHead}><h2>Rezervasyon sistemi</h2><p>Canlı fiyat ve müsaitlik bağlantısını mevcut rezervasyon veritabanından alacak şekilde bir sonraki katmanda tamamlıyoruz.</p></div>
        </div>
      </section>

      <footer className={styles.footer}><div className={styles.footerInner}><div><strong>Safira & Destan Villas</strong><p>Patara · Kaş · Antalya</p></div><div><p>safiradestan.com</p></div></div></footer>
    </main>
  );
}
