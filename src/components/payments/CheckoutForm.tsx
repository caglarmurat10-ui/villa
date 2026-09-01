"use client";

import { useState } from "react";
import Script from "next/script";
import { trackBeginCheckout, type PaymentTypeAnalytics, type VillaId } from "@/lib/analytics";
import styles from "./CheckoutForm.module.css";

export default function CheckoutForm({
  paymentId,
  villaId,
  villaName,
  paymentType,
  testMode,
}: {
  paymentId: string;
  villaId: VillaId;
  villaName: string;
  paymentType: PaymentTypeAnalytics;
  testMode: boolean;
}) {
  // Bilerek BOŞ başlar - mevcut reservation kaydındaki misafir adı/telefonu buraya OTOMATİK
  // doldurulmaz (ödeme linkinin sahibi her zaman aynı kişi olmayabilir; iletişim bilgilerini
  // kullanıcı kendisi girer).
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [resizerReady, setResizerReady] = useState(false);

  async function startCheckout(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, name, email, phone, address }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Ödeme oturumu başlatılamadı.");
      setIframeUrl(data.iframeUrl);
      trackBeginCheckout({ villa_id: villaId, villa_name: villaName }, paymentType, testMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ödeme oturumu başlatılamadı.");
    } finally {
      setLoading(false);
    }
  }

  if (iframeUrl) {
    return (
      <div className={styles.iframeWrap}>
        <Script
          src="https://www.paytr.com/js/iframeResizer.min.js?v2"
          strategy="afterInteractive"
          onLoad={() => {
            setResizerReady(true);
            const win = window as unknown as { iFrameResize?: (options: object, selector: string) => void };
            win.iFrameResize?.({}, "#paytr-iframe");
          }}
        />
        {!resizerReady ? <p className={styles.loadingNote}>Güvenli ödeme ekranı yükleniyor…</p> : null}
        <iframe id="paytr-iframe" src={iframeUrl} frameBorder="0" scrolling="no" style={{ width: "100%" }} title="PayTR güvenli ödeme" />
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={startCheckout}>
      <label>
        <span>Ad Soyad</span>
        <input type="text" required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ad Soyad" autoComplete="name" />
      </label>
      <label>
        <span>E-posta</span>
        <input type="email" required maxLength={100} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ornek@eposta.com" autoComplete="email" />
      </label>
      <label>
        <span>Telefon</span>
        <input type="tel" required maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="05xx xxx xx xx" autoComplete="tel" />
      </label>
      <label>
        <span>Adres</span>
        <input type="text" required maxLength={400} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Fatura/iletişim adresi" autoComplete="street-address" />
      </label>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Hazırlanıyor…" : "Güvenli Ödemeye Geç"}</button>
      <p className={styles.trustNote}>Güvenli kart ödeme işlemi PayTR altyapısı üzerinden gerçekleştirilir. Kart bilgileriniz Safira &amp; Destan Villas sistemlerinde saklanmaz.</p>
    </form>
  );
}
