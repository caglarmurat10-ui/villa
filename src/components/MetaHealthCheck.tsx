"use client";

import { useState } from "react";

type HealthItem = {
  villa: "Safira" | "Destan";
  platform: "Instagram" | "Facebook";
  connected: boolean;
  healthy: boolean;
  label: string;
};

type HealthResponse = {
  checkedAt: string;
  healthy: boolean;
  checks: HealthItem[];
};

export default function MetaHealthCheck() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HealthResponse | null>(null);
  const [error, setError] = useState("");

  async function runCheck() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/meta/health", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Meta bağlantıları test edilemedi.");
        return;
      }
      setResult(data as HealthResponse);
    } catch {
      setError("Meta sağlık kontrolüne ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="meta-health">
    <div className="meta-health-head"><div><strong>Canlı bağlantı testi</strong><p>Şifreli kayıtlı tokenları Meta API üzerinde doğrular. Token değeri ekrana veya tarayıcıya gönderilmez.</p></div><button type="button" onClick={runCheck} disabled={loading}>{loading ? "Kontrol ediliyor…" : "Bağlantıları test et"}</button></div>
    {error ? <p className="meta-health-error">{error}</p> : null}
    {result ? <div className="meta-health-results">{result.checks.map((item) => <div key={`${item.villa}-${item.platform}`} className={item.healthy ? "healthy" : item.connected ? "warning" : "missing"}><span>{item.healthy ? "✓" : item.connected ? "!" : "–"}</span><div><strong>Villa {item.villa} · {item.platform}</strong><small>{item.label}</small></div></div>)}</div> : null}
  </div>;
}
