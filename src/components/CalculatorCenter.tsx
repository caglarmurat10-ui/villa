"use client";

import { useMemo, useState } from "react";

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });

export default function CalculatorCenter({ defaultCommission }: { defaultCommission: number }) {
  const [nights, setNights] = useState(1);
  const [nightlyRate, setNightlyRate] = useState(0);
  const [commission, setCommission] = useState(defaultCommission);
  const [paid, setPaid] = useState(0);

  const result = useMemo(() => {
    const gross = Math.max(0, nights) * Math.max(0, nightlyRate);
    const fee = gross * Math.min(100, Math.max(0, commission)) / 100;
    const net = gross - fee;
    return { gross, fee, net, remaining: Math.max(0, gross - Math.max(0, paid)) };
  }, [nights, nightlyRate, commission, paid]);

  return <div className="calculator-center">
    <section className="settings-box calculator-form">
      <span className="ops-eyebrow">HIZLI HESAP</span><h2>Rezervasyon hesabı</h2><p>Gecelik fiyat ve gece sayısından brüt gelir, komisyon, net gelir ve kalan ödemeyi anında hesaplayın.</p>
      <div className="settings-two"><label>Gece sayısı<input type="number" min="1" value={nights} onChange={(e) => setNights(Number(e.target.value))} /></label><label>Gecelik fiyat (₺)<input type="number" min="0" value={nightlyRate} onChange={(e) => setNightlyRate(Number(e.target.value))} /></label></div>
      <div className="settings-two"><label>Komisyon %<input type="number" min="0" max="100" step="0.1" value={commission} onChange={(e) => setCommission(Number(e.target.value))} /></label><label>Alınan ödeme (₺)<input type="number" min="0" value={paid} onChange={(e) => setPaid(Number(e.target.value))} /></label></div>
    </section>

    <section className="calc-result-grid">
      <article><span>Brüt</span><strong>{money.format(result.gross)}</strong></article>
      <article><span>Komisyon</span><strong>{money.format(result.fee)}</strong></article>
      <article><span>Net</span><strong>{money.format(result.net)}</strong></article>
      <article><span>Kalan ödeme</span><strong>{money.format(result.remaining)}</strong></article>
    </section>
  </div>;
}
