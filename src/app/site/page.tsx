import Link from "next/link";
import PublicBookingWidget from "@/components/PublicBookingWidget";
import { listPriceRanges, listReservations } from "@/lib/db";
import styles from "./site.module.css";

export const dynamic = "force-dynamic";

const MEDIA = {
  safiraHero: "https://drive.google.com/uc?export=view&id=1JL-isYYwAC7gtdKvIVogGnvZjB_3rXs5",
  safiraAlt: "https://drive.google.com/uc?export=view&id=1RqmKOcfGBYrSF1ZJHaJhKdN915nmUrlS",
  destanHero: "https://drive.google.com/uc?export=view&id=1IipTx5zZfOge9Y1rQJBpW8BK9zBU2tgj",
  destanSuite: "https://drive.google.com/uc?export=view&id=1NmKtSAV2d4SUdYZo3qpfTJuROhgRExIH",
} as const;

export default async function PublicHomePage() {
  const [reservations, prices] = await Promise.all([listReservations(), listPriceRanges()]);
  const bookingReservations = reservations.map(({ villa, checkIn, checkOut }) => ({ villa, checkIn, checkOut }));
  const bookingPrices = prices.map(({ villa, startDate, endDate, nightlyRate }) => ({ villa, startDate, endDate, nightlyRate }));

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <img className={styles.heroImage} src={MEDIA.safiraHero} alt="Villa Safira ve özel havuzu" referrerPolicy="no-referrer" />
        <div className={styles.heroShade} />
        <nav className={styles.nav} aria-label="Ana menü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
          <div className={styles.navlinks}>
            <a href="#villalar">Villalar</a>
            <a href="#musaitlik">Müsaitlik</a>
            <a href="#deneyim">Deneyim</a>
            <a href="#iletisim" className={styles.cta}>İletişim</a>
          </div>
        </nav>

        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>Patara · Kaş · Antalya</div>
          <h1 className={styles.title}>Akdeniz’de<br />kendinize ait<br />bir yer.</h1>
          <p className={styles.lead}>Villa Safira ve Villa Destan. Özel havuz, özgürlük ve doğrudan rezervasyon kolaylığıyla Patara’da size ait bir tatil deneyimi.</p>
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
        <div className={styles.editorialHead}><span className={styles.kicker}>VİLLALARIMIZ</span><h2>Hangisi sizin<br />tatiliniz?</h2><p>İki villayı da gerçek fotoğraflarıyla keşfedin; size en uygun olanı seçin.</p></div>
        <div className={styles.villaGrid}>
          <Link className={styles.villaStory} href="/villa-safira">
            <div className={styles.storyImage}><img src={MEDIA.safiraHero} alt="Villa Safira dış görünüm ve havuz" referrerPolicy="no-referrer" /><span>Safira&apos;yı keşfet ↗</span></div>
            <div className={styles.storyMeta}><div><small>VILLA 01</small><h3>Villa Safira</h3></div><p>Doğayla çevrili, ferah ve özel bir villa tatili.</p></div>
          </Link>
          <Link className={`${styles.villaStory} ${styles.storyOffset}`} href="/villa-destan">
            <div className={styles.storyImage}><img src={MEDIA.destanHero} alt="Villa Destan havuz ve bahçe görünümü" referrerPolicy="no-referrer" /><span>Destan&apos;ı keşfet ↗</span></div>
            <div className={styles.storyMeta}><div><small>VILLA 02</small><h3>Villa Destan</h3></div><p>Özel alanları ve güçlü detaylarıyla özgün bir kaçış.</p></div>
          </Link>
        </div>
      </section>

      <section className={styles.experience} id="deneyim">
        <div className={styles.experiencePhoto}><img src={MEDIA.destanSuite} alt="Villa Destan yatak odası ve jakuzi" referrerPolicy="no-referrer" /></div>
        <div className={styles.experienceCopy}><span className={styles.kicker}>DOĞRUDAN KONAKLAMA</span><h2>Arada kimse yok.<br />Tatiliniz bize emanet.</h2><p>Rezervasyon takvimi, dönemsel fiyatlar ve villa bilgileri aynı yönetim altyapısından gelir. Böylece gördüğünüz bilgiyle bizim gördüğümüz bilgi aynı kalır.</p><div className={styles.points}><div><b>01</b><span>Canlı müsaitlik</span></div><div><b>02</b><span>Doğrudan iletişim</span></div><div><b>03</b><span>Şeffaf fiyat</span></div></div></div>
      </section>

      <section className={styles.locationBlock}>
        <span className={styles.kicker}>PATARA · KAŞ</span>
        <h2>Günün ritmini<br />siz belirleyin.</h2>
        <p>Sabah havuz başında, gün içinde Akdeniz’in kıyılarında, akşam yeniden kendi alanınızda. Safira & Destan, tatili programdan çıkarıp size bırakmak için var.</p>
        <a href="#iletisim">Rezervasyon hakkında konuşalım →</a>
      </section>

      <footer className={styles.footer} id="iletisim">
        <div className={styles.footerBrand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></div>
        <div className={styles.footerGrid}><div><small>KONUM</small><p>Patara · Kaş · Antalya</p></div><div><small>REZERVASYON</small><p>Müsaitlik kontrolünü yukarıdaki canlı takvimden yapabilirsiniz.</p></div><div><small>WEB</small><p>safiradestan.com</p></div></div>
        <div className={styles.footerBottom}>Safira & Destan Villas <span>Akdeniz’de size ait bir tatil.</span></div>
      </footer>
    </main>
  );
}
