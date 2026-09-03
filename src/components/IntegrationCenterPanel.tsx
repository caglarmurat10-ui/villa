import type { IntegrationCenterSnapshot } from "@/lib/integration-center";
import { GOOGLE_ADS_CAMPAIGN_DRAFTS, GOOGLE_ADS_CONVERSION_MAPPING, GOOGLE_ADS_NEGATIVE_KEYWORDS } from "@/lib/google-ads-campaign-drafts";
import { META_ADS_CAMPAIGN_DRAFTS, META_ADS_READINESS_NOTES } from "@/lib/meta-ads-campaign-drafts";
import PaytrConnectivityTest from "@/components/PaytrConnectivityTest";

type ServiceState = "PASS" | "READY" | "WARNING" | "WAITING_EXTERNAL_ACCESS" | "WAITING_USER_ACTION" | "FAIL";

interface ServiceRow {
  name: string;
  status: ServiceState;
  lastSuccess: string | null;
  lastCheck: string | null;
  lastError: string | null;
  actionRequired: string | null;
}

const STATE_STYLE: Record<ServiceState, { color: string; bg: string; border: string; text: string }> = {
  PASS: { color: "#86efac", bg: "#071b16", border: "#1f5f3b", text: "PASS" },
  READY: { color: "#86efac", bg: "#071b16", border: "#1f5f3b", text: "READY" },
  WARNING: { color: "#fbbf24", bg: "#241a06", border: "#a16207", text: "WARNING" },
  WAITING_EXTERNAL_ACCESS: { color: "#93c5fd", bg: "#0b1728", border: "#334b69", text: "BEKLİYOR (dış erişim)" },
  WAITING_USER_ACTION: { color: "#93c5fd", bg: "#0b1728", border: "#334b69", text: "BEKLİYOR (kullanıcı)" },
  FAIL: { color: "#fca5a5", bg: "#2a0a0a", border: "#dc2626", text: "FAIL" },
};

function statusBadge(state: ServiceState) {
  const style = STATE_STYLE[state];
  return <span style={{ padding: "3px 8px", borderRadius: 99, border: `1px solid ${style.border}`, background: style.bg, color: style.color, fontSize: 9, fontWeight: 900, whiteSpace: "nowrap" }}>{style.text}</span>;
}

function timeAgo(iso: string | null) {
  if (!iso) return "hiç";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "hiç";
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} sa önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

function buildServiceRows(snapshot: IntegrationCenterSnapshot): ServiceRow[] {
  const now = new Date().toISOString();
  const otaRow = (platform: "airbnb" | "booking"): ServiceRow => {
    const rows = snapshot.otaConnections.filter((c) => c.platform === platform);
    const connected = rows.filter((r) => r.connected);
    const anyRed = rows.some((r) => r.health === "red");
    const anyYellow = rows.some((r) => r.health === "yellow");
    const lastSuccess = rows.reduce<string | null>((latest, r) => (!r.lastSuccessAt ? latest : !latest || r.lastSuccessAt > latest ? r.lastSuccessAt : latest), null);
    const lastCheck = rows.reduce<string | null>((latest, r) => (!r.lastSyncedAt ? latest : !latest || r.lastSyncedAt > latest ? r.lastSyncedAt : latest), null);
    const lastError = rows.map((r) => r.lastError).filter(Boolean).join(" · ") || null;
    const conflictCount = rows.reduce((sum, r) => sum + r.conflictCount, 0);
    return {
      name: platform === "airbnb" ? "Airbnb (iCal)" : "Booking.com (iCal)",
      status: connected.length === 0 ? "WAITING_EXTERNAL_ACCESS" : anyRed ? "FAIL" : anyYellow ? "WARNING" : "PASS",
      lastSuccess,
      lastCheck,
      lastError,
      actionRequired: connected.length === 0
        ? "Villa başına import URL'si (KV) yapılandırılmalı"
        : conflictCount > 0
          ? `${conflictCount} needs_review bloğu admin takviminde incelenmeli`
          : anyRed
            ? "Senkron hatası - /entegrasyonlar detayına bakın"
            : null,
    };
  };

  const paytrStatus: ServiceState = snapshot.paytr.state === "PAYTR_READY" ? "READY" : snapshot.paytr.state === "PAYTR_TEST_MODE_ONLY" ? "WARNING" : "WAITING_USER_ACTION";
  const metaOrganicOk = snapshot.metaOrganic.safiraInstagramConnected && snapshot.metaOrganic.safiraFacebookConnected && snapshot.metaOrganic.destanFacebookConnected;

  return [
    { name: "Worker", status: snapshot.workerVersionId ? "PASS" : "WARNING", lastSuccess: now, lastCheck: now, lastError: null, actionRequired: snapshot.workerVersionId ? null : "CF_VERSION_METADATA binding eksik" },
    { name: "D1", status: snapshot.d1Healthy ? "PASS" : "FAIL", lastSuccess: snapshot.d1Healthy ? now : null, lastCheck: now, lastError: snapshot.d1Healthy ? null : "SELECT 1 başarısız", actionRequired: snapshot.d1Healthy ? null : "D1 binding/veritabanı erişimini kontrol edin" },
    { name: "Cron", status: snapshot.cronHealthy ? "PASS" : "WARNING", lastSuccess: snapshot.cronHeartbeat?.ranAt ?? null, lastCheck: now, lastError: null, actionRequired: snapshot.cronHeartbeat ? null : "Heartbeat hiç yazılmamış - cron tetikleyicisini kontrol edin" },
    otaRow("airbnb"),
    otaRow("booking"),
    { name: "PayTR", status: paytrStatus, lastSuccess: null, lastCheck: now, lastError: null, actionRequired: snapshot.paytr.state === "PAYTR_NOT_CONFIGURED" ? "PAYTR_MERCHANT_ID/KEY/SALT secret olarak eklenmeli" : "Aşağıdaki checklist + Bağlantı Testi ile merchant panel adımlarını teyit edin" },
    { name: "Search Console", status: snapshot.google.searchConsoleState === "GOOGLE_READY" ? "READY" : "WAITING_EXTERNAL_ACCESS", lastSuccess: snapshot.google.searchConsole ? now : null, lastCheck: now, lastError: snapshot.google.searchConsoleError, actionRequired: snapshot.google.searchConsoleState === "GOOGLE_READY" ? null : (snapshot.google.oauthClientConfigured ? "OAuth bağlantısını /sosyal sayfasından tamamlayın" : "GOOGLE_CLIENT_ID/SECRET secret olarak eklenmeli") },
    { name: "GA4", status: snapshot.google.ga4State === "GOOGLE_READY" ? "READY" : "WAITING_EXTERNAL_ACCESS", lastSuccess: snapshot.google.ga4 ? now : null, lastCheck: now, lastError: snapshot.google.ga4Error, actionRequired: snapshot.google.ga4State === "GOOGLE_READY" ? null : (snapshot.google.oauthClientConfigured ? "OAuth bağlantısını /sosyal sayfasından tamamlayın" : "GOOGLE_CLIENT_ID/SECRET secret olarak eklenmeli") },
    {
      name: "Google Business Profile",
      status: "WAITING_EXTERNAL_ACCESS",
      lastSuccess: null,
      lastCheck: null,
      lastError: null,
      actionRequired: snapshot.google.gbpState === "WAITING_OWNER_ACCESS"
        ? "OAuth bağlandı - /entegrasyonlar'da 'GBP Hesap/Location Keşfet' ile hesap/location bulup Safira/Destan için seçin"
        : "Önce Google Business Profile'a bağlanın (oauth start?scope=gbp) - kod hazır (READY_TO_CONNECT)",
    },
    {
      name: "Google Ads",
      status: snapshot.googleAds.state === "GOOGLE_ADS_READY_READ_ONLY" ? "READY" : "WAITING_USER_ACTION",
      lastSuccess: null,
      lastCheck: null,
      lastError: null,
      actionRequired: snapshot.googleAds.state === "GOOGLE_ADS_READY_READ_ONLY" ? "Ön koşullar tamam - taslak kampanyalar hazır, canlıya almadan önce bütçe onayı gerekli" : snapshot.googleAds.missing[0],
    },
    { name: "Meta Organik", status: metaOrganicOk ? "PASS" : "WARNING", lastSuccess: metaOrganicOk ? now : null, lastCheck: now, lastError: null, actionRequired: metaOrganicOk ? null : "Eksik hesap bağlantısını /sosyal sayfasından tamamlayın" },
    {
      name: "Meta Ads",
      status: "WAITING_USER_ACTION",
      lastSuccess: null,
      lastCheck: null,
      lastError: null,
      actionRequired: snapshot.metaAds.missing[0],
    },
  ];
}

export default function IntegrationCenterPanel({ snapshot }: { snapshot: IntegrationCenterSnapshot }) {
  const rows = buildServiceRows(snapshot);

  return (
    <section style={{ maxWidth: 1250, margin: "0 auto 18px", padding: "0 20px" }}>
      <div style={{ border: "1px solid #334b69", borderRadius: 16, background: "#081522", padding: 16, color: "#eef6ff" }}>
        <small style={{ display: "block", fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#93c5fd" }}>SİSTEM DURUMU</small>
        <h2 style={{ margin: "5px 0 12px", fontSize: 18 }}>Entegrasyon Merkezi</h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#9fb0c5", fontSize: 9, textTransform: "uppercase" }}>
                <th style={{ padding: "6px 8px" }}>Servis</th>
                <th style={{ padding: "6px 8px" }}>Durum</th>
                <th style={{ padding: "6px 8px" }}>Son başarı</th>
                <th style={{ padding: "6px 8px" }}>Son kontrol</th>
                <th style={{ padding: "6px 8px" }}>Son hata</th>
                <th style={{ padding: "6px 8px" }}>Gereken aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} style={{ borderTop: "1px solid #1c2e46" }}>
                  <td style={{ padding: "7px 8px", fontWeight: 800, color: "#dbeafe", whiteSpace: "nowrap" }}>{row.name}</td>
                  <td style={{ padding: "7px 8px" }}>{statusBadge(row.status)}</td>
                  <td style={{ padding: "7px 8px", color: "#8fa4bd" }}>{timeAgo(row.lastSuccess)}</td>
                  <td style={{ padding: "7px 8px", color: "#8fa4bd" }}>{timeAgo(row.lastCheck)}</td>
                  <td style={{ padding: "7px 8px", color: row.lastError ? "#fca5a5" : "#556275" }}>{row.lastError ?? "—"}</td>
                  <td style={{ padding: "7px 8px", color: row.actionRequired ? "#fbbf24" : "#556275" }}>{row.actionRequired ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid #203954" }}>
          <summary style={{ fontSize: 11, color: "#93c5fd", fontWeight: 800, cursor: "pointer" }}>
            PayTR merchant panel checklist ({snapshot.paytr.state})
          </summary>
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            {snapshot.paytr.merchantPanelChecklist.map((item) => (
              <div key={item.label} style={{ padding: "8px 10px", border: "1px solid #223a57", borderRadius: 9, background: "#0b1728", fontSize: 9 }}>
                <b style={{ color: item.status === "VERIFIED" ? "#86efac" : "#dbeafe" }}>
                  {item.status === "VERIFIED" ? "✓" : item.status === "NOT_VERIFIED" ? "✗" : "○"} {item.label}
                  {item.status === "MANUAL_ONLY" ? <span style={{ color: "#8fa4bd", fontWeight: 700 }}> (yalnız elle doğrulanabilir)</span> : null}
                </b>
                <p style={{ margin: "4px 0 0", color: "#9fb0c5" }}>{item.note}</p>
              </div>
            ))}
          </div>
          <PaytrConnectivityTest />
        </details>

        <details style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid #203954" }}>
          <summary style={{ fontSize: 11, color: "#93c5fd", fontWeight: 800, cursor: "pointer" }}>
            Google Ads — {snapshot.googleAds.state} · {GOOGLE_ADS_CAMPAIGN_DRAFTS.length} DRAFT kampanya (hiçbiri gönderilmedi)
          </summary>
          <div style={{ padding: "8px 10px", margin: "10px 0", border: "1px solid #223a57", borderRadius: 9, background: "#0b1728", fontSize: 9, color: "#9fb0c5" }}>
            <ul style={{ margin: 0, paddingLeft: 16 }}>{snapshot.googleAds.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {GOOGLE_ADS_CAMPAIGN_DRAFTS.map((c) => (
              <div key={c.id} style={{ padding: "8px 10px", border: "1px solid #223a57", borderRadius: 9, background: "#0b1728", fontSize: 9 }}>
                <b style={{ color: "#dbeafe" }}>{c.name} · {c.campaignType} · {c.status}</b>
                {c.keywords.length > 0 ? <p style={{ margin: "4px 0 0", color: "#9fb0c5" }}>Anahtar kelimeler: {c.keywords.join(", ")}</p> : null}
                <p style={{ margin: "4px 0 0", color: "#8fa4bd" }}>Bütçe: {c.dailyBudgetNote}</p>
              </div>
            ))}
            <div style={{ padding: "8px 10px", border: "1px solid #223a57", borderRadius: 9, background: "#0b1728", fontSize: 9, color: "#9fb0c5" }}>
              <b style={{ color: "#dbeafe" }}>Negatif anahtar kelimeler:</b> {GOOGLE_ADS_NEGATIVE_KEYWORDS.join(", ")}
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid #223a57", borderRadius: 9, background: "#0b1728", fontSize: 9, color: "#9fb0c5" }}>
              <b style={{ color: "#dbeafe" }}>Conversion eşlemesi (GA4 event isimleriyle birebir):</b>
              <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>{GOOGLE_ADS_CONVERSION_MAPPING.map((m) => <li key={m.gtmEvent}>{m.gtmEvent} — {m.note}</li>)}</ul>
            </div>
          </div>
        </details>

        <details style={{ marginTop: 10, paddingTop: 13, borderTop: "1px solid #203954" }}>
          <summary style={{ fontSize: 11, color: "#93c5fd", fontWeight: 800, cursor: "pointer" }}>
            Meta Ads — {snapshot.metaAds.state} · {META_ADS_CAMPAIGN_DRAFTS.length} DRAFT kampanya (hiçbiri gönderilmedi)
          </summary>
          <div style={{ padding: "8px 10px", margin: "10px 0", border: "1px solid #223a57", borderRadius: 9, background: "#0b1728", fontSize: 9, color: "#9fb0c5" }}>
            <ul style={{ margin: 0, paddingLeft: 16 }}>{snapshot.metaAds.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {META_ADS_CAMPAIGN_DRAFTS.map((c) => (
              <div key={c.id} style={{ padding: "8px 10px", border: "1px solid #223a57", borderRadius: 9, background: "#0b1728", fontSize: 9 }}>
                <b style={{ color: "#dbeafe" }}>{c.name} · {c.objective} · {c.status}</b>
                <p style={{ margin: "4px 0 0", color: "#9fb0c5" }}>Kitle: {c.audienceNote}</p>
                <p style={{ margin: "4px 0 0", color: "#8fa4bd" }}>Kreatif: {c.creativeConcept}</p>
              </div>
            ))}
            <div style={{ padding: "8px 10px", border: "1px solid #223a57", borderRadius: 9, background: "#0b1728", fontSize: 9, color: "#9fb0c5" }}>
              <ul style={{ margin: 0, paddingLeft: 16 }}>{META_ADS_READINESS_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
