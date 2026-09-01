import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayment } from "@/lib/payments/db";
import { toVillaId } from "@/lib/analytics";
import PaymentResultTracker from "@/components/payments/PaymentResultTracker";
import styles from "../../../site/site.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ödeme | Safira & Destan Villas", robots: { index: false, follow: false } };

// merchant_ok_url yalnız kullanıcı deneyimi içindir - GERÇEK durum burada D1'den TAZE okunur,
// yönlendirmenin kendisi hiçbir zaman "ödendi" kabul edilmez (asıl kaynak: PayTR'ın server-to-server
// callback'i, ayrı route).
export default async function PaymentSuccessInfoPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const payment = await getPayment(paymentId);
  if (!payment) notFound();

  const villaName = `Villa ${payment.villa}`;
  const analyticsPaymentType = payment.paymentType === "deposit" ? "deposit" as const : "full_payment" as const;
  const confirmed = payment.status === "paid";

  return (
    <main className={styles.page}>
      <section className={styles.policyHead}>
        <nav className={styles.nav} aria-label="Ana menü">
          <Link href="/" className={styles.brand}><span>SAFIRA</span><i>&</i><span>DESTAN</span></Link>
        </nav>
        <div className={styles.policyHeadCopy}>
          <span className={styles.eyebrow}>{confirmed ? "ÖDEME ALINDI" : "ÖDEME İŞLENİYOR"}</span>
          <h1 className={styles.policyTitle}>{villaName}</h1>
        </div>
      </section>
      <section className={styles.policyBody}>
        {confirmed ? (
          <>
            <p>✓ Ödemeniz alındı ve onaylandı. Teşekkür ederiz — en kısa sürede sizinle iletişime geçeceğiz.</p>
            <PaymentResultTracker success villaId={toVillaId(payment.villa)} villaName={villaName} paymentType={analyticsPaymentType} testMode={payment.testMode} />
          </>
        ) : (
          <p>Ödemeniz alınmış olabilir, onay bekleniyor. Bu sayfa kesin sonucu göstermiyor — birkaç dakika içinde durum güncellenmezse bizimle iletişime geçin.</p>
        )}
      </section>
    </main>
  );
}
