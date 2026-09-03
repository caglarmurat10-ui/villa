import styles from "./TrustStrip.module.css";

// Hero ile müsaitlik/rezervasyon bölümü arasındaki ince güven bandı. Yalnız gerçek/aktif
// durumları listeler - "Peşin fiyatına N taksit" satırı installmentVerified=false iken hiç
// render edilmez (bkz. src/lib/payments/installment-campaign.ts: merchant doğrulaması
// tamamlanmadan public'e asla çıkmaz).
export default function TrustStrip({ installmentVerified, maxInstallment }: { installmentVerified: boolean; maxInstallment: number }) {
  const items = [
    "Canlı müsaitlik",
    "Dönemsel net fiyat",
    "Ödeme sırasında işletme komisyonu eklenmez",
    "Doğrudan rezervasyon",
  ];
  if (installmentVerified) items.push(`Peşin fiyatına ${maxInstallment} taksit`);

  return (
    <div className={styles.strip}>
      <ul className={styles.list} aria-label="Rezervasyon güvenceleri">
        {items.map((item) => (
          <li key={item}><span className={styles.check} aria-hidden="true">✓</span>{item}</li>
        ))}
      </ul>
    </div>
  );
}
