"use client";

import { useState } from "react";

type TestResult = {
  ok: boolean;
  message: string;
  providerReason?: string;
  testedAt: string;
};

// PARA HAREKETİ YOK - yalnız /api/admin/payments/paytr-test'i çağırır (o da yalnız PayTR get-token
// bağlantısını sentetik veriyle test eder, D1'e yazmaz, hiçbir gerçek ödeme oluşturmaz).
export default function PaytrConnectivityTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState("");

  async function runTest() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/payments/paytr-test", { method: "POST", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Bağlantı testi çalıştırılamadı.");
        return;
      }
      setResult(data as TestResult);
    } catch {
      setError("Bağlantı testine ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={runTest}
        disabled={loading}
        style={{ padding: "8px 12px", border: "1px solid #47617f", borderRadius: 8, background: "#102238", color: "#dbeafe", fontSize: 10, fontWeight: 800, cursor: loading ? "wait" : "pointer" }}
      >
        {loading ? "Test ediliyor…" : "Bağlantı Testini Çalıştır (para hareketi yok)"}
      </button>
      {error ? <p style={{ marginTop: 6, fontSize: 10, color: "#fca5a5" }}>{error}</p> : null}
      {result ? (
        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, border: `1px solid ${result.ok ? "#1f5f3b" : "#dc2626"}`, background: result.ok ? "#071b16" : "#2a0a0a", fontSize: 10, color: result.ok ? "#bbf7d0" : "#fca5a5" }}>
          <b>{result.ok ? "✓ Bağlantı doğrulandı" : "✗ Bağlantı başarısız"}</b>
          <p style={{ margin: "4px 0 0" }}>{result.message}</p>
          {result.providerReason ? <p style={{ margin: "4px 0 0", color: "#9fb0c5" }}>PayTR yanıtı: {result.providerReason}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
