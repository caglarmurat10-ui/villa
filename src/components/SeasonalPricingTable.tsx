import type { PriceRange, Villa } from "@/lib/types";
import styles from "./SeasonalPricingTable.module.css";

type BookingPrice = Pick<PriceRange, "villa" | "startDate" | "endDate" | "nightlyRate" | "basePriceMinor" | "baseNights" | "minimumNights">;

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const moneyPrecise = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

function formatRange(start: string, end: string) {
  return `${dateFmt.format(new Date(`${start}T00:00:00Z`))} – ${dateFmt.format(new Date(`${end}T00:00:00Z`))}`;
}

function yearOf(iso: string) {
  return Number(iso.slice(0, 4));
}

/**
 * Public fiyat kartı yönetim panelindeki gerçek D1 kayıtlarından gelir.
 * Kullanıcının son kararı gereği içinde bulunduğumuz takvim yılının kapanan/eski fiyat kartları
 * public vitrinde gösterilmez; varsa bir sonraki satış sezonu (örn. 2027) öne çıkarılır.
 * Bir sonraki yıl henüz tanımlı değilse mevcut/yaklaşan gerçek kayıtlar gösterilmeye devam eder.
 */
export default function SeasonalPricingTable({ villa, prices, todayIso }: { villa: Villa; prices: BookingPrice[]; todayIso: string }) {
  const upcoming = prices
    .filter((p) => p.villa === villa && p.endDate >= todayIso)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (upcoming.length === 0) return null;

  const currentYear = yearOf(todayIso);
  const nextSeasonYear = upcoming
    .map((range) => yearOf(range.startDate))
    .filter((year) => year > currentYear)
    .sort((a, b) => a - b)[0];

  const displayed = nextSeasonYear
    ? upcoming.filter((range) => yearOf(range.startDate) === nextSeasonYear)
    : upcoming;

  return (
    <section className={styles.section} id="donemsel-fiyatlar">
      <span className={styles.kicker}>GÜNCEL SATIŞ SEZONU</span>
      <h2>Villa {villa} sezon fiyatı</h2>
      <p className={styles.note}>
        Fiyat yönetim panelindeki güncel kayıt üzerinden gösterilir. Tarihinizi seçtiğinizde kesin toplam konaklama bedeli ayrıca hesaplanır.
      </p>

      <div className={styles.grid}>
        {displayed.map((range) => {
          const hasWeeklyBase =
            typeof range.basePriceMinor === "number" &&
            typeof range.baseNights === "number" &&
            range.baseNights > 0;
          const weeklyTotal = hasWeeklyBase ? range.basePriceMinor! / 100 : null;
          const referenceNightly = hasWeeklyBase ? weeklyTotal! / range.baseNights! : range.nightlyRate;

          return (
            <article className={styles.card} key={`${range.startDate}-${range.endDate}`}>
              <span className={styles.badge}>Güncel sezon</span>
              <span className={styles.dates}>{formatRange(range.startDate, range.endDate)}</span>

              {hasWeeklyBase ? (
                <>
                  <strong className={styles.rate}>
                    {moneyPrecise.format(referenceNightly)} <small>/ gece</small>
                  </strong>
                  <span className={styles.cashPrice}>
                    Peşin sezon fiyatı: <b>{money.format(weeklyTotal!)}</b> / {range.baseNights} gece
                  </span>
                </>
              ) : (
                <strong className={styles.rate}>
                  {money.format(range.nightlyRate)} <small>/ gece</small>
                </strong>
              )}

              <div className={styles.paymentInfo}>
                <strong>Kartla ödeme</strong>
                <span>3 veya 6 taksit seçeneği</span>
                <small>
                  Kesin taksit seçenekleri ve kartınıza uygulanacak koşullar güvenli PayTR ödeme ekranında gösterilir.
                </small>
              </div>

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
