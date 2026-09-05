"use client";

import { useEffect, useState } from "react";
import type { Villa } from "@/lib/types";

type CapabilityStatus = { key: string; label: string; available: boolean; requiredPermission: string };
type AgentRun = { id: string; agentType: string; startedAt: string; status: string; candidateCount: number; requiredPermission: string | null };
type StatusResponse = { capabilities: CapabilityStatus[]; summary: { total: number; available: number; pending: number }; recentRuns: AgentRun[] };

type Prospect = {
  id: string; username: string; category: string; finalGrowthScore: number | null;
  followersCount: number | null; status: string;
};
type Opportunity = { id: string; targetUsername: string; context: string | null; riskClassification: string; status: string };
type AnalyticsSnapshot = {
  villa: Villa;
  last7Days: { published: number; planned: number };
  last30Days: { published: number; planned: number };
  instagramQuota: { quotaUsage: number; quotaTotal: number; remaining: number } | null;
  note: string;
};

const cardStyle: React.CSSProperties = { padding: "13px", border: "1px solid #334b69", borderRadius: 12, background: "#071321" };
const sectionStyle: React.CSSProperties = { maxWidth: 1250, margin: "12px auto", padding: "0 20px" };
const boxStyle: React.CSSProperties = { padding: 16, border: "1px solid #334155", borderRadius: 16, background: "#0f1b2d", color: "#f8fafc" };

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function SocialGrowthAgentPanel() {
  const [villa, setVilla] = useState<Villa>("Safira");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchJson<StatusResponse>("/api/social-growth/status").then((data) => { if (data) setStatus(data); });
  }, []);

  useEffect(() => {
    async function loadVillaData() {
      setLoading(true);
      const [prospectsRes, opportunitiesRes, analyticsRes] = await Promise.all([
        fetchJson<{ prospects: Prospect[] }>(`/api/social-growth/prospects?villa=${villa}`),
        fetchJson<{ opportunities: Opportunity[] }>(`/api/social-growth/opportunities?villa=${villa}`),
        fetchJson<{ snapshot: AnalyticsSnapshot }>(`/api/social-growth/analytics?villa=${villa}`),
      ]);
      setProspects(prospectsRes?.prospects ?? []);
      setOpportunities(opportunitiesRes?.opportunities ?? []);
      setAnalytics(analyticsRes?.snapshot ?? null);
      setLoading(false);
    }
    void loadVillaData();
  }, [villa]);

  async function markProspect(id: string, next: string) {
    const response = await fetch(`/api/social-growth/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (response.ok) {
      const data = await fetchJson<{ prospects: Prospect[] }>(`/api/social-growth/prospects?villa=${villa}`);
      setProspects(data?.prospects ?? []);
    }
  }

  return <section style={sectionStyle}>
    <div style={boxStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <small style={{ display: "block", color: "#93c5fd", fontSize: 9, fontWeight: 900, letterSpacing: 1.4 }}>SOCIAL GROWTH AGENT · FAZ 1</small>
          <h2 style={{ margin: "5px 0 4px", fontSize: 19 }}>Keşif, öneriler ve büyüme analitiği</h2>
          <p style={{ margin: 0, color: "#b8c6d8", fontSize: 12 }}>Hiçbir otomatik follow/unfollow/like/yorum yapılmaz; yalnız resmi Meta API&apos;leri ve insan onayı ile çalışır. Aşağıdaki özelliklerin çoğu şu an ek Meta izni bekliyor (PENDING_PERMISSION) — izin alındığında otomatik aktif olur.</p>
        </div>
        <div>{(["Safira", "Destan"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setVilla(item)}
            style={{ marginLeft: 6, padding: "8px 12px", borderRadius: 9, fontWeight: 800, fontSize: 11, cursor: "pointer", border: villa === item ? "1px solid #60a5fa" : "1px solid #334155", background: villa === item ? "#1d3a5f" : "transparent", color: "#f8fafc" }}>
            Villa {item}
          </button>
        ))}</div>
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={{ fontSize: 10, color: "#c8d3e3", fontWeight: 750 }}>Agent Durumu {status ? `· ${status.summary.available}/${status.summary.total} özellik kullanılabilir` : ""}</b>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 8, marginTop: 8 }}>
          {(status?.capabilities ?? []).map((item) => (
            <div key={item.key} style={cardStyle}>
              <strong style={{ display: "block", fontSize: 12, marginBottom: 4 }}>{item.available ? "🟢" : "🟡"} {item.label}</strong>
              {!item.available ? <small style={{ color: "#94a3b8" }}>PENDING_PERMISSION: {item.requiredPermission}</small> : null}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={{ fontSize: 10, color: "#c8d3e3", fontWeight: 750 }}>Büyüme Analitiği · Villa {villa}</b>
        {analytics ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8, marginTop: 8 }}>
          <div style={cardStyle}><small style={{ color: "#94a3b8" }}>Son 7 gün</small><div style={{ fontSize: 18, fontWeight: 800 }}>{analytics.last7Days.published} yayınlandı</div><small style={{ color: "#64748b" }}>{analytics.last7Days.planned} planlı bekliyor</small></div>
          <div style={cardStyle}><small style={{ color: "#94a3b8" }}>Son 30 gün</small><div style={{ fontSize: 18, fontWeight: 800 }}>{analytics.last30Days.published} yayınlandı</div><small style={{ color: "#64748b" }}>{analytics.last30Days.planned} planlı bekliyor</small></div>
          <div style={cardStyle}><small style={{ color: "#94a3b8" }}>Instagram API kotası</small><div style={{ fontSize: 18, fontWeight: 800 }}>{analytics.instagramQuota ? `${analytics.instagramQuota.remaining}/${analytics.instagramQuota.quotaTotal}` : "—"}</div></div>
        </div> : null}
        {analytics?.note ? <p style={{ margin: "8px 0 0", fontSize: 10, color: "#fbbf24" }}>ℹ {analytics.note}</p> : null}
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={{ fontSize: 10, color: "#c8d3e3", fontWeight: 750 }}>Keşfedilen Hesaplar &amp; Takip Önerileri</b>
        {loading ? <p style={{ color: "#94a3b8", fontSize: 11 }}>Yükleniyor…</p> : prospects.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>Henüz veri yok — hesap keşfi (hashtag/business discovery) PENDING_PERMISSION durumunda. Meta&apos;dan gerekli izin alındığında burada otomatik önerilen hesaplar listelenecek.</p>
        ) : <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {prospects.map((item) => <div key={item.id} style={cardStyle}>
            <strong>@{item.username}</strong> <small style={{ color: "#94a3b8" }}>· {item.category} · skor {item.finalGrowthScore ?? "—"}</small>
            <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
              <a href={`https://instagram.com/${item.username}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#93c5fd" }}>Profili incele →</a>
              <button type="button" onClick={() => markProspect(item.id, "WATCHLIST")} style={{ fontSize: 10 }}>Takip edildi olarak işaretle</button>
              <button type="button" onClick={() => markProspect(item.id, "DISMISSED")} style={{ fontSize: 10 }}>Geç</button>
              <button type="button" onClick={() => markProspect(item.id, "BLOCKED")} style={{ fontSize: 10 }}>Engelle</button>
            </div>
          </div>)}
        </div>}
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={{ fontSize: 10, color: "#c8d3e3", fontWeight: 750 }}>Etkileşim Fırsatları</b>
        {opportunities.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>Henüz veri yok — üçüncü taraf içeriklerinde etkileşim önerisi üretmek için Comments/Mentions izni (PENDING_PERMISSION) gerekiyor.</p>
        ) : <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {opportunities.map((item) => <div key={item.id} style={cardStyle}>
            <strong>@{item.targetUsername}</strong> <small style={{ color: "#94a3b8" }}>· {item.riskClassification}</small>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#cbd5e1" }}>{item.context}</p>
          </div>)}
        </div>}
      </div>

      <p style={{ marginTop: 14, fontSize: 10, color: "#64748b" }}>Mention&apos;lar, DM Lead&apos;leri ve Agent Geçmişi bölümleri de aynı PENDING_PERMISSION modeliyle hazır; ilgili Meta izinleri alındığında bu ekranda otomatik görünür olacaklar.</p>
    </div>
  </section>;
}
