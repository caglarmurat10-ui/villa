import type { InstallmentCampaignReadiness } from "@/lib/payments/installment-campaign";
import styles from "./InstallmentCampaignBanner.module.css";

// Doğrulama tamamlanana kadar PUBLIC hiçbir şey render etmez - INSTALLMENT_CAMPAIGN_VERIFIED
// olmadan bu component çağrıldığı her yerde sessizce null döner. "Peşin fiyatına" iddiası yalnız
// gerçek PayTR merchant panel + gerçek ödeme kanıtı ile INSTALLMENT_CAMPAIGN_MERCHANT_VERIFIED=true
// koduna geçildiğinde ve en az bir gerçek ödemede tutarlar eşleştiğinde görünür.
// Yasal/finansal olarak kanıtlanmamış "tüm kartlara"/"faizsiz"/"komisyonsuz" ifadeleri bilerek YOK.
export default function InstallmentCampaignBanner({ readiness, variant = "card" }: { readiness: InstallmentCampaignReadiness; variant?: "card" | "compact" }) {
  if (readiness.state !== "INSTALLMENT_CAMPAIGN_VERIFIED") return null;

  return (
    <div className={variant === "compact" ? styles.compact : styles.card}>
      <strong className={styles.headline}>Peşin Fiyatına 3 veya 6 Taksit</strong>
      <p className={styles.body}>Villa Safira ve Villa Destan&apos;da uygun kartlara {readiness.maxInstallment} taksite kadar ödeme seçeneği. Toplam rezervasyon tutarı değişmez.</p>
      <small className={styles.disclaimer}>Kesin taksit tutarları kartınıza göre ödeme ekranında görüntülenir.</small>
    </div>
  );
}
