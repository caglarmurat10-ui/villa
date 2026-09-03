import type { PriceRange, Villa } from "@/lib/types";
import styles from "./SeasonalPricingTable.module.css";

type BookingPrice = Pick<PriceRange, "villa" | "startDate" | "endDate" | "nightlyRate">;

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long" });
function formatRange(start: string, end: string) {
  return `${dateFmt.format(new Date(`${start}T00:00:00Z`))} – ${dateFmt.format(new Date(`${end}T00:00:00Z`))}`;
}

// Yalnız gerçek D1 price_ranges verisini gösterir - örnek/tahmini rakam yok. Geçmiş dönemler
// (endDate bugünden önce) varsayılan olarak gizlenir, yaklaşan dönemler tarih sırasıyla listelenir.
// Hiç yaklaşan dönem yoksa bölüm hiç render edilmez (boş/uydurma bir tablo göstermez).
export default function SeasonalPricingTable({ villa, prices, todayIso }: { villa: Villa; prices: BookingPrice[]; todayIso: string }) {
  const upcoming = prices
    .filter((p) => p.villa === villa && p.endDate >= todayIso)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (upcoming.length === 0) return null;

  return (
    <section className={styles.section} id="donemsel-fiyatlar">
      <span className={styles.kicker}>DÖNEMSEL FİYATLAR</span>
      <h2>Villa {villa} gecelik fiyatları</h2>
      <p className={styles.note}>Aşağıdaki fiyatlar gecelik konaklama bedelidir ve yönetim panelindeki güncel fiyat kayıtlarından gelir.</p>
      <div className={styles.grid}>
        {upcoming.map((range) => {
          const isCurrent = range.startDate <= todayIso && range.endDate >= todayIso;
          return (
            <article className={styles.card} key={`${range.startDate}-${range.endDate}`}>
              {isCurrent ? <span className={styles.badge}>Şu an geçerli</span> : null}
              <span className={styles.dates}>{formatRange(range.startDate, range.endDate)}</span>
              <strong className={styles.rate}>{money.format(range.nightlyRate)} <small>/ gece</small></strong>
            </article>
          );
        })}
      </div>
    </section>
  );
}
