import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayment } from "@/lib/payments/db";
import { toVillaId } from "@/lib/analytics";
import PaymentResultTracker from "@/components/payments/PaymentResultTracker";
import styles from "../../../site/site.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ödeme | Safira & Destan Villas", robots: { index: false, follow: false } };

// merchant_fail_url yalnız kullanıcı deneyimi içindir - GERÇEK başarısızlık durumu burada D1'den
// TAZE okunur. Yönlendirmenin kendisi başarısızlığın tek kaynağı DEĞİLDİR (asıl kaynak: PayTR'ın
// server-to-server callback'i).
export default async function PaymentFailureInfoPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const payment = await getPayment(paymentId);
  if (!payment) notFound();

  const villaName = `Villa ${payment.villa}`;
  const analyticsPaymentType = payment.paymentType === "deposit" ? "deposit" as const : "full_payment" as const;

  return (
    <main className={styles.page}>
      <section className={styles.policyHead}>
        <nav className={styles.nav} aria-label="Ana menü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
        </nav>
        <div className={styles.policyHeadCopy}>
          <span className={styles.eyebrow}>{payment.status === "paid" ? "ÖDEME ALINDI" : "ÖDEME TAMAMLANAMADI"}</span>
          <h1 className={styles.policyTitle}>{villaName}</h1>
        </div>
      </section>
      <section className={styles.policyBody}>
        {payment.status === "paid" ? (
          <>
            <p>✓ Ödemeniz aslında alınmış görünüyor. Teşekkür ederiz — en kısa sürede sizinle iletişime geçeceğiz.</p>
            <PaymentResultTracker success villaId={toVillaId(payment.villa)} villaName={villaName} paymentType={analyticsPaymentType} testMode={payment.testMode} />
          </>
        ) : payment.status === "failed" ? (
          <>
            <p>Ödemeniz tamamlanamadı. Kartınızla ilgili bir sorun oluşmuş olabilir. Yeni bir ödeme linki için lütfen bizimle iletişime geçin.</p>
            <PaymentResultTracker success={false} villaId={toVillaId(payment.villa)} villaName={villaName} paymentType={analyticsPaymentType} testMode={payment.testMode} />
          </>
        ) : (
          <p>Bu ödeme denemesi tamamlanamadı. Yeni bir ödeme linki için lütfen bizimle iletişime geçin.</p>
        )}
      </section>
    </main>
  );
}
