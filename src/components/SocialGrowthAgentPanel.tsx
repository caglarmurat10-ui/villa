"use client";

import { useEffect, useMemo, useState } from "react";
import type { Villa } from "@/lib/types";

type CapabilityStatus = { key: string; label: string; available: boolean; requiredPermission: string };
type AgentRun = { id: string; agentType: string; startedAt: string; status: string; candidateCount: number; requiredPermission: string | null; notes: string | null };
type StatusResponse = { capabilities: CapabilityStatus[]; summary: { total: number; available: number; pending: number }; recentRuns: AgentRun[] };

type ProspectCategory =
  | "travel_creator" | "local_creator" | "tourism_page" | "local_business"
  | "photographer" | "food_creator" | "family_travel" | "lifestyle_creator" | "high_value_guest_source";

type Prospect = {
  id: string; username: string; displayName: string | null; profileUrl: string | null;
  category: ProspectCategory; locationHint: string | null; finalGrowthScore: number | null;
  followersCount: number | null; status: string; shortReason: string | null; sourceType: string | null; discoveredAt: string;
};
type Opportunity = { id: string; targetUsername: string; context: string | null; suggestedComment: string | null; riskClassification: string; status: string };
type AnalyticsSnapshot = {
  villa: Villa;
  last7Days: { published: number; planned: number };
  last30Days: { published: number; planned: number };
  instagramQuota: { quotaUsage: number; quotaTotal: number; remaining: number } | null;
  note: string;
};

const CATEGORY_OPTIONS: { value: ProspectCategory; label: string }[] = [
  { value: "travel_creator", label: "Travel creator" },
  { value: "local_creator", label: "Local creator" },
  { value: "tourism_page", label: "Tourism page" },
  { value: "local_business", label: "Local business" },
  { value: "photographer", label: "Photographer" },
  { value: "food_creator", label: "Food creator" },
  { value: "family_travel", label: "Family travel" },
  { value: "lifestyle_creator", label: "Lifestyle" },
  { value: "high_value_guest_source", label: "High value guest source" },
];

const cardStyle: React.CSSProperties = { padding: "13px", border: "1px solid #334b69", borderRadius: 12, background: "#071321" };
const sectionStyle: React.CSSProperties = { maxWidth: 1250, margin: "12px auto", padding: "0 20px" };
const boxStyle: React.CSSProperties = { padding: 16, border: "1px solid #334155", borderRadius: 16, background: "#0f1b2d", color: "#f8fafc" };
const subHeadStyle: React.CSSProperties = { fontSize: 10, color: "#c8d3e3", fontWeight: 750 };
const smallButtonStyle: React.CSSProperties = { fontSize: 10, padding: "5px 8px", borderRadius: 7, border: "1px solid #334155", background: "#0b1728", color: "#f8fafc", cursor: "pointer" };

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function ProspectCard({ item, onStatusChange, onCommentSuggestion, suggestion }: {
  item: Prospect;
  onStatusChange: (id: string, status: string) => void;
  onCommentSuggestion: (id: string) => void;
  suggestion?: string;
}) {
  return <div style={cardStyle}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
      <div>
        <strong>@{item.username}</strong>{item.displayName ? <span style={{ color: "#94a3b8" }}> · {item.displayName}</span> : null}
        <div style={{ marginTop: 2 }}><small style={{ color: "#94a3b8" }}>{item.category} · {item.locationHint ?? "konum belirtilmemiş"} · skor {item.finalGrowthScore ?? "—"}</small></div>
        {item.shortReason ? <p style={{ margin: "4px 0 0", fontSize: 11, color: "#cbd5e1" }}>{item.shortReason}</p> : null}
      </div>
      <span style={{ fontSize: 9, color: "#64748b", whiteSpace: "nowrap" }}>{item.sourceType === "public_web_search" ? "🔎 public scout" : item.sourceType === "manual_entry" ? "✍️ manuel" : ""}</span>
    </div>
    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
      {item.profileUrl ? <a href={item.profileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#93c5fd" }}>İncele →</a> : null}
      <button type="button" style={smallButtonStyle} onClick={() => onStatusChange(item.id, "WATCHLIST")}>Watchlist&apos;e ekle</button>
      <button type="button" style={smallButtonStyle} onClick={() => onStatusChange(item.id, "FOLLOWED_MANUALLY")}>Takip edildi olarak işaretle</button>
      <button type="button" style={smallButtonStyle} onClick={() => onStatusChange(item.id, "DISMISSED")}>Geç</button>
      <button type="button" style={smallButtonStyle} onClick={() => onStatusChange(item.id, "BLOCKED")}>Engelle</button>
      <button type="button" style={smallButtonStyle} onClick={() => onCommentSuggestion(item.id)}>Yorum önerisi üret</button>
    </div>
    {suggestion ? <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "#081522", border: "1px solid #fbbf2455" }}>
      <small style={{ color: "#fbbf24" }}>REVIEW_REQUIRED · öneri (otomatik gönderilmez):</small>
      <p style={{ margin: "4px 0 0", fontSize: 12 }}>{suggestion}</p>
    </div> : null}
  </div>;
}

export default function SocialGrowthAgentPanel() {
  const [villa, setVilla] = useState<Villa>("Safira");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});

  const [addForm, setAddForm] = useState({ platform: "Instagram", username: "", displayName: "", profileUrl: "", category: "travel_creator" as ProspectCategory, locationHint: "", notes: "" });
  const [addError, setAddError] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  useEffect(() => {
    void fetchJson<StatusResponse>("/api/social-growth/status").then((data) => { if (data) setStatus(data); });
    void fetchJson<{ runs: AgentRun[] }>("/api/social-growth/agent-runs").then((data) => { if (data) setAgentRuns(data.runs); });
  }, []);

  async function reloadProspects() {
    const data = await fetchJson<{ prospects: Prospect[] }>(`/api/social-growth/prospects?villa=${villa}&limit=100`);
    setProspects(data?.prospects ?? []);
  }

  useEffect(() => {
    async function loadVillaData() {
      setLoading(true);
      const [prospectsRes, opportunitiesRes, analyticsRes] = await Promise.all([
        fetchJson<{ prospects: Prospect[] }>(`/api/social-growth/prospects?villa=${villa}&limit=100`),
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

  const today = useMemo(() => todayIso(), []);
  const todaysDiscoveries = useMemo(() => prospects.filter((p) => p.discoveredAt.slice(0, 10) === today), [prospects, today]);
  const recommendations = useMemo(
    () => prospects.filter((p) => !["DISMISSED", "BLOCKED", "FOLLOWED_MANUALLY"].includes(p.status)).slice(0, 10),
    [prospects],
  );
  const watchlist = useMemo(() => prospects.filter((p) => p.status === "WATCHLIST"), [prospects]);
  const followed = useMemo(() => prospects.filter((p) => p.status === "FOLLOWED_MANUALLY"), [prospects]);

  async function markProspect(id: string, next: string) {
    const response = await fetch(`/api/social-growth/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (response.ok) await reloadProspects();
  }

  async function requestCommentSuggestion(id: string) {
    const response = await fetch(`/api/social-growth/prospects/${id}/comment-suggestion`, { method: "POST" });
    if (!response.ok) return;
    const data = await response.json().catch(() => null) as { opportunity?: { suggestedComment?: string } } | null;
    if (data?.opportunity?.suggestedComment) {
      setSuggestions((prev) => ({ ...prev, [id]: data.opportunity!.suggestedComment! }));
    }
    const opportunitiesRes = await fetchJson<{ opportunities: Opportunity[] }>(`/api/social-growth/opportunities?villa=${villa}`);
    setOpportunities(opportunitiesRes?.opportunities ?? []);
  }

  async function submitAddForm(event: React.FormEvent) {
    event.preventDefault();
    setAddError("");
    setAddSubmitting(true);
    try {
      const response = await fetch("/api/social-growth/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addForm, villa }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAddError(data.error ?? "Hesap eklenemedi.");
        return;
      }
      setAddForm({ platform: "Instagram", username: "", displayName: "", profileUrl: "", category: "travel_creator", locationHint: "", notes: "" });
      await reloadProspects();
    } finally {
      setAddSubmitting(false);
    }
  }

  return <section style={sectionStyle}>
    <div style={boxStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <small style={{ display: "block", color: "#93c5fd", fontSize: 9, fontWeight: 900, letterSpacing: 1.4 }}>SOCIAL GROWTH AGENT</small>
          <h2 style={{ margin: "5px 0 4px", fontSize: 19 }}>Keşif, öneriler ve büyüme analitiği</h2>
          <p style={{ margin: 0, color: "#b8c6d8", fontSize: 12 }}>Hiçbir otomatik follow/unfollow/like/yorum yapılmaz. Public Web Scout yalnız herkese açık web arama sonuçlarını tarar (Instagram&apos;a login/scraping yok); takip ve yorum işlemleri her zaman manueldir.</p>
        </div>
        <div>{(["Safira", "Destan"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setVilla(item)}
            style={{ marginLeft: 6, padding: "8px 12px", borderRadius: 9, fontWeight: 800, fontSize: 11, cursor: "pointer", border: villa === item ? "1px solid #60a5fa" : "1px solid #334155", background: villa === item ? "#1d3a5f" : "transparent", color: "#f8fafc" }}>
            Villa {item}
          </button>
        ))}</div>
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={subHeadStyle}>Agent Durumu {status ? `· ${status.summary.available}/${status.summary.total} özellik kullanılabilir` : ""}</b>
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
        <b style={subHeadStyle}>Yeni Hesap Ekle</b>
        <form onSubmit={submitAddForm} style={{ ...cardStyle, marginTop: 8, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          <select value={addForm.platform} onChange={(e) => setAddForm((f) => ({ ...f, platform: e.target.value }))}>
            <option value="Instagram">Instagram</option>
            <option value="Facebook">Facebook</option>
          </select>
          <input required placeholder="@kullaniciadi" value={addForm.username} onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))} />
          <input placeholder="Görünen ad" value={addForm.displayName} onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))} />
          <input placeholder="Profil linki (opsiyonel)" value={addForm.profileUrl} onChange={(e) => setAddForm((f) => ({ ...f, profileUrl: e.target.value }))} />
          <select value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value as ProspectCategory }))}>
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input placeholder="Lokasyon (ör. Kaş)" value={addForm.locationHint} onChange={(e) => setAddForm((f) => ({ ...f, locationHint: e.target.value }))} />
          <input placeholder="Not (opsiyonel)" value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))} style={{ gridColumn: "1 / -1" }} />
          <button type="submit" disabled={addSubmitting} style={{ padding: "9px 12px", borderRadius: 9, background: "#2563eb", color: "#fff", border: 0, fontWeight: 800, cursor: "pointer" }}>{addSubmitting ? "Ekleniyor…" : "Villa " + villa + " için ekle"}</button>
          {addError ? <p style={{ gridColumn: "1 / -1", color: "#fca5a5", fontSize: 11, margin: 0 }}>{addError}</p> : null}
        </form>
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={subHeadStyle}>Büyüme Analitiği · Villa {villa}</b>
        {analytics ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8, marginTop: 8 }}>
          <div style={cardStyle}><small style={{ color: "#94a3b8" }}>Son 7 gün</small><div style={{ fontSize: 18, fontWeight: 800 }}>{analytics.last7Days.published} yayınlandı</div><small style={{ color: "#64748b" }}>{analytics.last7Days.planned} planlı bekliyor</small></div>
          <div style={cardStyle}><small style={{ color: "#94a3b8" }}>Son 30 gün</small><div style={{ fontSize: 18, fontWeight: 800 }}>{analytics.last30Days.published} yayınlandı</div><small style={{ color: "#64748b" }}>{analytics.last30Days.planned} planlı bekliyor</small></div>
          <div style={cardStyle}><small style={{ color: "#94a3b8" }}>Instagram API kotası</small><div style={{ fontSize: 18, fontWeight: 800 }}>{analytics.instagramQuota ? `${analytics.instagramQuota.remaining}/${analytics.instagramQuota.quotaTotal}` : "—"}</div></div>
        </div> : null}
        {analytics?.note ? <p style={{ margin: "8px 0 0", fontSize: 10, color: "#fbbf24" }}>ℹ {analytics.note}</p> : null}
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={subHeadStyle}>Bugünün Keşifleri ({todaysDiscoveries.length})</b>
        {loading ? <p style={{ color: "#94a3b8", fontSize: 11 }}>Yükleniyor…</p> : todaysDiscoveries.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>Bugün henüz yeni bir hesap keşfedilmedi. Public Web Scout günde bir kez (08:00) çalışır; arama API anahtarı tanımlı değilse manuel eklemeler dışında yeni keşif olmaz.</p>
        ) : <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {todaysDiscoveries.map((item) => <ProspectCard key={item.id} item={item} onStatusChange={markProspect} onCommentSuggestion={requestCommentSuggestion} suggestion={suggestions[item.id]} />)}
        </div>}
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={subHeadStyle}>Takip Önerileri (en yüksek skorlu {recommendations.length})</b>
        {recommendations.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>Henüz öneri yok. &quot;Yeni Hesap Ekle&quot; ile elle ekleyebilir veya Public Web Scout&apos;un otomatik keşiflerini bekleyebilirsiniz.</p>
        ) : <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {recommendations.map((item) => <ProspectCard key={item.id} item={item} onStatusChange={markProspect} onCommentSuggestion={requestCommentSuggestion} suggestion={suggestions[item.id]} />)}
        </div>}
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={subHeadStyle}>Watchlist ({watchlist.length})</b>
        {watchlist.length === 0 ? <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>Watchlist boş.</p> : <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {watchlist.map((item) => <ProspectCard key={item.id} item={item} onStatusChange={markProspect} onCommentSuggestion={requestCommentSuggestion} suggestion={suggestions[item.id]} />)}
        </div>}
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={subHeadStyle}>Manuel Takip Edilenler ({followed.length})</b>
        {followed.length === 0 ? <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>Henüz manuel olarak takip edildi işaretlenen hesap yok.</p> : <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {followed.map((item) => <ProspectCard key={item.id} item={item} onStatusChange={markProspect} onCommentSuggestion={requestCommentSuggestion} suggestion={suggestions[item.id]} />)}
        </div>}
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={subHeadStyle}>Etkileşim Fırsatları</b>
        {opportunities.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>Henüz üretilmiş bir yorum önerisi yok — yukarıdaki hesap kartlarından &quot;Yorum önerisi üret&quot;e basabilirsiniz.</p>
        ) : <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {opportunities.map((item) => <div key={item.id} style={cardStyle}>
            <strong>@{item.targetUsername}</strong> <small style={{ color: "#94a3b8" }}>· {item.riskClassification} · {item.status}</small>
            {item.context ? <p style={{ margin: "4px 0 0", fontSize: 11, color: "#cbd5e1" }}>{item.context}</p> : null}
            {item.suggestedComment ? <p style={{ margin: "6px 0 0", fontSize: 12, padding: 8, borderRadius: 8, background: "#081522" }}>{item.suggestedComment}</p> : null}
          </div>)}
        </div>}
      </div>

      <div style={{ marginTop: 14 }}>
        <b style={subHeadStyle}>Agent Geçmişi</b>
        {agentRuns.length === 0 ? <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>Henüz bir agent çalıştırması kaydedilmedi.</p> : <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {agentRuns.map((run) => <div key={run.id} style={{ ...cardStyle, padding: "8px 12px" }}>
            <small style={{ color: "#94a3b8" }}>{new Date(run.startedAt).toLocaleString("tr-TR")} · {run.agentType}</small>
            <div style={{ fontSize: 12 }}>{run.status === "OK" ? "✓" : run.status === "ERROR" ? "!" : "🟡"} {run.status}{run.candidateCount ? ` · ${run.candidateCount} aday` : ""}</div>
            {run.notes ? <small style={{ color: "#64748b" }}>{run.notes}</small> : null}
          </div>)}
        </div>}
      </div>
    </div>
  </section>;
}
