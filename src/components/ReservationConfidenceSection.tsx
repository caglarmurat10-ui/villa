import Link from "next/link";
import TrackedWhatsappLink from "@/components/analytics/TrackedWhatsappLink";
import { whatsappLink } from "@/lib/contact";
import styles from "./ReservationConfidenceSection.module.css";

// Rezervasyon widget'ından sonra kısa bir güven bölümü - yalnız GERÇEKTEN aktif/kanıtlı
// şeyleri listeler. PayTR canlı değilken "güvenli ödeme altyapısı" gibi bir madde bilerek
// YOK (bkz. src/lib/payments/types.ts PAYTR_TEST_MODE=true - yanlış claim üretmemek için).
const ITEMS = [
  { title: "Doğrudan villa yönetimi", body: "Talebiniz aracı olmadan doğrudan villa yönetimine ulaşır." },
  { title: "Canlı takvim", body: "Müsaitlik, yönetim sistemindeki gerçek rezervasyon kayıtlarıyla karşılaştırılır." },
  { title: "Net dönemsel fiyat", body: "Gördüğünüz toplam, seçtiğiniz tarihler için tanımlı gerçek fiyattır." },
  { title: "Rezervasyon koşulları", body: "Ön ödeme, iptal ve konaklama koşulları önceden bellidir." },
];

export default function ReservationConfidenceSection() {
  return (
    <section className={styles.section}>
      <div className={styles.grid}>
        {ITEMS.map((item) => (
          <div className={styles.item} key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
        <div className={styles.item}>
          <h3>WhatsApp iletişim</h3>
          <p>
            Sorularınız için <TrackedWhatsappLink href={whatsappLink("Merhaba, Villa Safira ve Villa Destan hakkında bilgi almak istiyorum.")} target="_blank" rel="noopener noreferrer" ctaLocation="homepage_confidence_section">doğrudan WhatsApp&apos;tan yazabilirsiniz</TrackedWhatsappLink>.
          </p>
        </div>
      </div>
      <Link className={styles.link} href="/rezervasyon-kosullari">Rezervasyon ve Konaklama Koşullarını İncele →</Link>
    </section>
  );
}
