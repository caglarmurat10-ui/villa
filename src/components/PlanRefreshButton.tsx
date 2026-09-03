"use client";

import { useState } from "react";

// Faz 6.1 bölüm 13 - önceden yalnız günlük cron ("0 3 * * *") tetikleyebiliyordu; admin'in
// kod deploy sonrası kendi isteğiyle idempotent bir yenileme yapabilmesi için manuel tetikleyici.
// GERÇEK PUBLISH YAPMAZ - yalnız social_posts'a 'Planlandı' satırları ekler/senkronlar (bkz.
// ensureRolling30DayPlan/ensureSpecialDayPosts, social-plan-seed.ts).
export default function PlanRefreshButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/social-posts/plan-30-day", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "Plan yenilenemedi.");
        return;
      }
      setResult(body);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1250, margin: "12px auto", padding: "0 20px" }}>
      <div style={{ border: "1px solid #223a57", borderRadius: 14, background: "#0b1728", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: 1.5, color: "#93c5fd", fontWeight: 800 }}>30 GÜNLÜK PLAN</span>
            <p style={{ margin: "4px 0 0", fontSize: 10, color: "#8fa4bd" }}>
              İçerik/bayram karmasını idempotent olarak yeniden dolduruyor - gerçek yayın YAPMAZ, yalnız plan satırları ekler/senkronlar.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            style={{ padding: "8px 12px", border: "1px solid #47617f", borderRadius: 8, background: "#102238", color: "#dbeafe", fontSize: 10, fontWeight: 800, cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? "Yenileniyor…" : "Planı Şimdi Yenile"}
          </button>
        </div>
        {error ? <p style={{ marginTop: 8, fontSize: 10, color: "#fca5a5" }}>{error}</p> : null}
        {result ? <pre style={{ marginTop: 8, fontSize: 9, color: "#9fb0c5", whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre> : null}
      </div>
    </div>
  );
}
