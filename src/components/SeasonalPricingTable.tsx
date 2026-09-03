import type { PriceRange, Villa } from "@/lib/types";
import styles from "./SeasonalPricingTable.module.css";

type BookingPrice = Pick<PriceRange, "villa" | "startDate" | "endDate" | "nightlyRate" | "basePriceMinor" | "baseNights" | "minimumNights">;

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const moneyPrecise = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
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

  // Şu an hiçbir dönem "geçerli" değilse (bugün, listelenen dönemlerin hiçbirinin içinde değil)
  // gösterilen ilk dönemle bugün arasında bir boşluk (kapalı sezon) var demektir - müşteri bunu
  // "neden ilk fiyatlı dönem bu kadar uzakta" diye sormasın diye kısa bir açıklama eklenir.
  const hasCurrent = upcoming.some((p) => p.startDate <= todayIso && p.endDate >= todayIso);

  return (
    <section className={styles.section} id="donemsel-fiyatlar">
      <span className={styles.kicker}>DÖNEMSEL FİYATLAR</span>
      <h2>Villa {villa} gecelik fiyatları</h2>
      <p className={styles.note}>Aşağıdaki fiyatlar yönetim panelindeki güncel fiyat kayıtlarından gelir.</p>
      {!hasCurrent && (
        <p className={styles.note}>{`${villa} için ${formatRange(upcoming[0].startDate, upcoming[0].endDate)} tarihleri arasındaki sezon açıktır.`}</p>
      )}
      <div className={styles.grid}>
        {upcoming.map((range) => {
          const isCurrent = range.startDate <= todayIso && range.endDate >= todayIso;
          // Haftalık esas fiyat modeli (2027 kararı gibi): esas toplam öne çıkar, gecelik rakam
          // yalnız esas toplamdan türetilmiş REFERANS değer olarak ikinci sırada gösterilir -
          // price-engine.ts'teki canonical hesaplamayla birebir aynı kaynaktan (basePriceMinor/
          // baseNights) türetilir, ayrı bir formülle uydurulmaz.
          const hasWeeklyBase = typeof range.basePriceMinor === "number" && typeof range.baseNights === "number" && range.baseNights > 0;
          const weeklyTotal = hasWeeklyBase ? range.basePriceMinor! / 100 : null;
          const referenceNightly = hasWeeklyBase ? range.basePriceMinor! / 100 / range.baseNights! : null;

          return (
            <article className={styles.card} key={`${range.startDate}-${range.endDate}`}>
              {isCurrent ? <span className={styles.badge}>Şu an geçerli</span> : null}
              <span className={styles.dates}>{formatRange(range.startDate, range.endDate)}</span>
              {hasWeeklyBase ? (
                <>
                  <strong className={styles.rate}>{money.format(weeklyTotal!)} <small>/ {range.baseNights} gece</small></strong>
                  <span className={styles.nightlyRef}>{moneyPrecise.format(referenceNightly!)} / gece</span>
                </>
              ) : (
                <strong className={styles.rate}>{money.format(range.nightlyRate)} <small>/ gece</small></strong>
              )}
              {typeof range.minimumNights === "number" && (
                <span className={styles.minStay}>Minimum {range.minimumNights} gece</span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
