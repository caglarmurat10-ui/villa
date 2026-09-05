"use client";

import { useEffect, useState } from "react";

type HealthItem = {
  villa: "Safira" | "Destan";
  platform: "Instagram" | "Facebook";
  connected: boolean;
  healthy: boolean;
  label: string;
};

type RelationshipItem = {
  villa: "Safira" | "Destan";
  status: "healthy" | "mismatch" | "missing" | "unavailable";
  healthy: boolean | null;
  label: string;
};

type BlockedItem = {
  villa: "Safira" | "Destan";
  platform: "Instagram" | "Facebook";
  label: string;
};

type HealthResponse = {
  checkedAt: string;
  healthy: boolean;
  relationshipsHealthy?: boolean;
  checks: HealthItem[];
  relationships?: RelationshipItem[];
  blocked?: BlockedItem[];
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

  useEffect(() => {
    void runCheck();
  }, []);

  return <div className="meta-health">
    <div className="meta-health-head"><div><strong>Canlı bağlantı testi</strong><p>Sayfa açıldığında otomatik çalışır. Safira ve Destan için Instagram/Facebook tokenlarını ve Meta içindeki Facebook ↔ Instagram eşleşmesini ayrı ayrı denetler. Token değeri ekrana veya tarayıcıya gönderilmez.</p></div><button type="button" onClick={runCheck} disabled={loading}>{loading ? "Kontrol ediliyor…" : "Yeniden kontrol et"}</button></div>
    {error ? <p className="meta-health-error">{error}</p> : null}
    {result ? <>
      <div className="meta-health-results">
        {result.checks.map((item) => <div key={`${item.villa}-${item.platform}`} className={item.healthy ? "healthy" : item.connected ? "warning" : "missing"}><span>{item.healthy ? "✓" : item.connected ? "!" : "–"}</span><div><strong>Villa {item.villa} · {item.platform}</strong><small>{item.label}</small></div></div>)}
        {(result.blocked ?? []).map((item) => <div key={`${item.villa}-${item.platform}-blocked`} className="warning"><span>!</span><div><strong>Villa {item.villa} · {item.platform} · HARD BLOCK</strong><small>{item.label}</small></div></div>)}
      </div>
      {(result.relationships ?? []).length ? <div className="meta-health-results" style={{marginTop:10}}>
        {(result.relationships ?? []).map((item) => {
          const className = item.status === "healthy" ? "healthy" : item.status === "unavailable" ? "warning" : "missing";
          const icon = item.status === "healthy" ? "✓" : item.status === "unavailable" ? "?" : "!";
          return <div key={`${item.villa}-relationship`} className={className}><span>{icon}</span><div><strong>Villa {item.villa} · Facebook ↔ Instagram</strong><small>{item.label}</small></div></div>;
        })}
      </div> : null}
    </> : null}
  </div>;
}
