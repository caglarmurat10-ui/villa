"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { trackBeginCheckout, type PaymentTypeAnalytics, type VillaId } from "@/lib/analytics";
import { LEGAL_ACCEPTANCE_VERSION, hasValidLegalConsent } from "@/lib/legal-consent";
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
  initialTermsAccepted = false,
  initialPrivacyNoticeAcknowledged = false,
  initialLegalVersion = LEGAL_ACCEPTANCE_VERSION,
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
  initialTermsAccepted?: boolean;
  initialPrivacyNoticeAcknowledged?: boolean;
  initialLegalVersion?: string;
  autoStart?: boolean;
}) {
  // Normal /odeme sayfasında alanlar boş başlayabilir. Public rezervasyon akışında ise müşteri
  // aynı bilgileri az önce girdiği için tekrar sordurulmaz; değerler güvenli checkout isteğine taşınır.
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress);
  const [termsAccepted, setTermsAccepted] = useState(initialTermsAccepted);
  const [privacyNoticeAcknowledged, setPrivacyNoticeAcknowledged] = useState(initialPrivacyNoticeAcknowledged);
  const [legalVersion] = useState(initialLegalVersion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [resizerReady, setResizerReady] = useState(false);
  const autoStarted = useRef(false);

  const requestCheckout = useCallback(async () => {
    const consent = { termsAccepted, privacyNoticeAcknowledged, legalVersion };
    if (!hasValidLegalConsent(consent)) {
      setError("Ödeme öncesinde sözleşme ve bilgilendirme onaylarını tamamlayın.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, name, email, phone, address, termsAccepted, privacyNoticeAcknowledged, legalVersion }),
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
  }, [address, email, legalVersion, name, paymentId, paymentType, phone, privacyNoticeAcknowledged, termsAccepted, testMode, villaId, villaName]);

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
      <div className={styles.consentGroup}>
        <label className={styles.consentRow}>
          <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required />
          <span><Link href="/rezervasyon-kosullari" target="_blank">Rezervasyon ve Konaklama Koşulları</Link>, <Link href="/on-bilgilendirme" target="_blank">Ön Bilgilendirme Formu</Link> ve <Link href="/mesafeli-hizmet-sozlesmesi" target="_blank">Mesafeli Hizmet Sözleşmesi</Link>&apos;ni okudum ve kabul ediyorum.</span>
        </label>
        <label className={styles.consentRow}>
          <input type="checkbox" checked={privacyNoticeAcknowledged} onChange={(event) => setPrivacyNoticeAcknowledged(event.target.checked)} required />
          <span><Link href="/gizlilik" target="_blank">Gizlilik Politikası</Link> ve <Link href="/kvkk" target="_blank">KVKK Aydınlatma Metni</Link>&apos;ni inceledim.</span>
        </label>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="submit" disabled={loading || !termsAccepted || !privacyNoticeAcknowledged}>{loading ? "Hazırlanıyor…" : "Güvenli Ödemeye Geç"}</button>
      <p className={styles.trustNote}>Güvenli kart ödeme işlemi PayTR altyapısı üzerinden gerçekleştirilir. Kart bilgileriniz Safira &amp; Destan Villas sistemlerinde saklanmaz.</p>
    </form>
  );
}
