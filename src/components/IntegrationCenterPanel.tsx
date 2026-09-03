import type { IntegrationCenterSnapshot } from "@/lib/integration-center";
import { GOOGLE_ADS_CAMPAIGN_DRAFTS, GOOGLE_ADS_CONVERSION_MAPPING, GOOGLE_ADS_NEGATIVE_KEYWORDS } from "@/lib/google-ads-campaign-drafts";
import { META_ADS_CAMPAIGN_DRAFTS, META_ADS_READINESS_NOTES } from "@/lib/meta-ads-campaign-drafts";

type Chip = { label: string; state: "PASS" | "READY" | "WARNING" | "WAITING_EXTERNAL_ACCESS" | "WAITING_USER_ACTION" | "FAIL"; detail?: string };

const STATE_STYLE: Record<Chip["state"], { color: string; bg: string; border: string; text: string }> = {
  PASS: { color: "#86efac", bg: "#071b16", border: "#1f5f3b", text: "PASS" },
  READY: { color: "#86efac", bg: "#071b16", border: "#1f5f3b", text: "READY" },
  WARNING: { color: "#fbbf24", bg: "#241a06", border: "#a16207", text: "WARNING" },
  WAITING_EXTERNAL_ACCESS: { color: "#93c5fd", bg: "#0b1728", border: "#334b69", text: "BEKLİYOR (dış erişim)" },
  WAITING_USER_ACTION: { color: "#93c5fd", bg: "#0b1728", border: "#334b69", text: "BEKLİYOR (kullanıcı)" },
  FAIL: { color: "#fca5a5", bg: "#2a0a0a", border: "#dc2626", text: "FAIL" },
};

function chip({ label, state, detail }: Chip) {
  const style = STATE_STYLE[state];
  return (
    <div key={label} style={{ padding: "10px 11px", border: `1px solid ${style.border}`, borderRadius: 10, background: style.bg }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: "#9fb0c5", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 900, color: style.color, marginTop: 3 }}>{style.text}</div>
      {detail ? <div style={{ fontSize: 9, color: "#8fa4bd", marginTop: 3, lineHeight: 1.4 }}>{detail}</div> : null}
    </div>
  );
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

export default function IntegrationCenterPanel({ snapshot }: { snapshot: IntegrationCenterSnapshot }) {
  const otaByPlatform = (platform: "airbnb" | "booking") => {
    const rows = snapshot.otaConnections.filter((c) => c.platform === platform);
    const anyRed = rows.some((r) => r.health === "red");
    const anyYellow = rows.some((r) => r.health === "yellow");
    const state: Chip["state"] = !rows.some((r) => r.connected)
      ? "WAITING_EXTERNAL_ACCESS"
      : anyRed ? "FAIL" : anyYellow ? "WARNING" : "PASS";
    const conflictCount = rows.reduce((sum, r) => sum + r.conflictCount, 0);
    return chip({
      label: platform === "airbnb" ? "Airbnb (iCal)" : "Booking.com (iCal)",
      state,
      detail: `${rows.filter((r) => r.connected).length}/${rows.length} villa bağlı${conflictCount > 0 ? ` · ${conflictCount} inceleme bekleyen blok` : ""} · Partner API: WAITING_PARTNER_ACCESS`,
    });
  };

  const paytrState: Chip["state"] = snapshot.paytr.state === "PAYTR_READY" ? "READY" : snapshot.paytr.state === "PAYTR_TEST_MODE_ONLY" ? "WARNING" : "WAITING_USER_ACTION";
  const googleAdsChip = chip({ label: "Google Ads", state: "WAITING_USER_ACTION", detail: "Kod yok - OAuth+developer token+customer ID gerekli" });
  const metaAdsChip = chip({ label: "Meta Ads", state: "WAITING_USER_ACTION", detail: "Kod yok - ads_management izni gerekli" });
  const gbpChip = chip({ label: "Google Business Profile", state: "WAITING_EXTERNAL_ACCESS", detail: "Gerçek API erişimi yok" });

  return (
    <section style={{ maxWidth: 1250, margin: "0 auto 18px", padding: "0 20px" }}>
      <div style={{ border: "1px solid #334b69", borderRadius: 16, background: "#081522", padding: 16, color: "#eef6ff" }}>
        <small style={{ display: "block", fontSize: 9, fontWeight: 900, letterSpacing: 1.4, color: "#93c5fd" }}>SİSTEM DURUMU</small>
        <h2 style={{ margin: "5px 0 12px", fontSize: 18 }}>Entegrasyon Merkezi</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
          {chip({ label: "Worker", state: snapshot.workerVersionId ? "PASS" : "WARNING", detail: snapshot.workerVersionId ? `v ${snapshot.workerVersionId.slice(0, 8)}` : "version metadata yok" })}
          {chip({ label: "D1", state: snapshot.d1Healthy ? "PASS" : "FAIL" })}
          {chip({ label: "Cron", state: snapshot.cronHealthy ? "PASS" : "WARNING", detail: snapshot.cronHeartbeat ? `son çalışma ${timeAgo(snapshot.cronHeartbeat.ranAt)}` : "heartbeat yok" })}
          {otaByPlatform("airbnb")}
          {otaByPlatform("booking")}
          {chip({ label: "PayTR", state: paytrState, detail: `test_mode=${snapshot.paytr.testMode ? "true" : "false"}` })}
          {chip({ label: "Search Console", state: snapshot.google.searchConsoleState === "GOOGLE_READY" ? "READY" : "WAITING_EXTERNAL_ACCESS" })}
          {chip({ label: "GA4", state: snapshot.google.ga4State === "GOOGLE_READY" ? "READY" : "WAITING_EXTERNAL_ACCESS" })}
          {gbpChip}
          {googleAdsChip}
          {chip({
            label: "Meta Organik",
            state: snapshot.metaOrganic.safiraInstagramConnected && snapshot.metaOrganic.safiraFacebookConnected && snapshot.metaOrganic.destanFacebookConnected ? "PASS" : "WARNING",
            detail: `Safira IG${snapshot.metaOrganic.safiraInstagramConnected ? "✓" : "✗"} FB${snapshot.metaOrganic.safiraFacebookConnected ? "✓" : "✗"} · Destan FB${snapshot.metaOrganic.destanFacebookConnected ? "✓" : "✗"} · IG HARD BLOCK`,
          })}
          {metaAdsChip}
          {chip({
            label: "Son 7 gün yayın",
            state: snapshot.publishStats7.failedCount > 0 ? "WARNING" : "PASS",
            detail: `${snapshot.publishStats7.publishedCount} başarılı · ${snapshot.publishStats7.failedCount} hatalı`,
          })}
          {chip({ label: "Son OTA sync", state: snapshot.lastOtaSyncAt ? "PASS" : "WARNING", detail: timeAgo(snapshot.lastOtaSyncAt) })}
        </div>

        <details style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid #203954" }}>
          <summary style={{ fontSize: 11, color: "#93c5fd", fontWeight: 800, cursor: "pointer" }}>
            Google Ads taslak kampanyalar ({GOOGLE_ADS_CAMPAIGN_DRAFTS.length} DRAFT — hesap/bütçe gelince kullanılabilir, hiçbiri gönderilmedi)
          </summary>
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
            Meta Ads taslak kampanyalar ({META_ADS_CAMPAIGN_DRAFTS.length} DRAFT — ad_account gelince kullanılabilir, hiçbiri gönderilmedi)
          </summary>
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
