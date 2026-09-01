import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayment, computeReservationPaymentSummary } from "@/lib/payments/db";
import { toVillaId } from "@/lib/analytics";
import CheckoutForm from "@/components/payments/CheckoutForm";
import styles from "../../site/site.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Güvenli Ödeme | Safira & Destan Villas",
  robots: { index: false, follow: false },
};

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

function minorToTry(minor: number) {
  return minor / 100;
}

export default async function PaymentCheckoutPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const payment = await getPayment(paymentId);
  if (!payment) notFound();

  const summary = await computeReservationPaymentSummary(payment.reservationId);
  const villaName = `Villa ${payment.villa}`;
  const paymentTypeLabel = payment.paymentType === "deposit" ? "%20 Ön Ödeme" : "Tam Ödeme";
  const analyticsPaymentType = payment.paymentType === "deposit" ? "deposit" as const : "full_payment" as const;

  return (
    <main className={styles.page}>
      <section className={styles.policyHead}>
        <nav className={styles.nav} aria-label="Ana menü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
        </nav>
        <div className={styles.policyHeadCopy}>
          <span className={styles.eyebrow}>GÜVENLİ ÖDEME</span>
          <h1 className={styles.policyTitle}>{villaName} — {paymentTypeLabel}</h1>
          <p className={styles.lead}>
            {dateFormat.format(new Date(`${payment.checkIn}T00:00:00`))} — {dateFormat.format(new Date(`${payment.checkOut}T00:00:00`))}
          </p>
        </div>
      </section>

      <section className={styles.policySummary}>
        <div className={styles.factChips}>
          <span className={styles.factChip}>Rezervasyon Toplamı: {money.format(minorToTry(summary.reservationTotalMinor))}</span>
          <span className={styles.factChip}>{paymentTypeLabel}: {money.format(minorToTry(payment.requestedAmountMinor))}</span>
          <span className={styles.factChip}>Kalan: {money.format(minorToTry(summary.remainingTotalMinor))}</span>
        </div>
      </section>

      <section className={styles.policyBody}>
        {payment.status === "paid" ? (
          <p>✓ Bu ödeme tamamlandı. Teşekkür ederiz — en kısa sürede sizinle iletişime geçeceğiz.</p>
        ) : (
          <>
            {payment.paymentType === "full_payment" && (
              <p>Tam ödeme seçeneğinde uygun kredi kartlarına 6 taksite kadar ödeme imkânı sunulabilir. Kullanılabilir taksit seçenekleri ve varsa vade farkı PayTR ödeme ekranında kartınıza göre gösterilir.</p>
            )}
            <CheckoutForm paymentId={payment.id} villaId={toVillaId(payment.villa)} villaName={villaName} paymentType={analyticsPaymentType} />
          </>
        )}
      </section>
    </main>
  );
}
