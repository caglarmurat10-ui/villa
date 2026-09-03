"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { trackBeginCheckout, type PaymentTypeAnalytics, type VillaId } from "@/lib/analytics";
import styles from "./CheckoutForm.module.css";

export default function CheckoutForm({
  paymentId,
  villaId,
  villaName,
  paymentType,
  testMode,
  initialName = "",
  initialEmail = "",
  initialPhone = "",
  initialAddress = "",
  autoStart = false,
}: {
  paymentId: string;
  villaId: VillaId;
  villaName: string;
  paymentType: PaymentTypeAnalytics;
  testMode: boolean;
  initialName?: string;
  initialEmail?: string;
  initialPhone?: string;
  initialAddress?: string;
  autoStart?: boolean;
}) {
  // Normal /odeme sayfasında alanlar boş başlayabilir. Public rezervasyon akışında ise müşteri
  // aynı bilgileri az önce girdiği için tekrar sordurulmaz; değerler güvenli checkout isteğine taşınır.
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [resizerReady, setResizerReady] = useState(false);
  const autoStarted = useRef(false);

  const requestCheckout = useCallback(async () => {
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
  }, [address, email, name, paymentId, paymentType, phone, testMode, villaId, villaName]);

  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    void requestCheckout();
  }, [autoStart, requestCheckout]);

  async function startCheckout(event: React.FormEvent) {
    event.preventDefault();
    await requestCheckout();
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
        {!resizerReady ? <p className={styles.loadingNote}>Güvenli kart ödeme ekranı yükleniyor…</p> : null}
        <iframe
          id="paytr-iframe"
          src={iframeUrl}
          frameBorder="0"
          scrolling="no"
          style={{ width: "100%" }}
          title="PayTR güvenli ödeme"
        />
      </div>
    );
  }

  if (autoStart) {
    return (
      <div className={styles.autoStart}>
        {loading ? <p className={styles.loadingNote}>Güvenli kart ödeme ekranı hazırlanıyor…</p> : null}
        {error ? (
          <>
            <p className={styles.error}>{error}</p>
            <button type="button" onClick={() => void requestCheckout()}>Tekrar dene</button>
          </>
        ) : null}
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
