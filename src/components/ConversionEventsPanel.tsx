import type { ConversionEventName, ConversionEventSummaryRow, ConversionRateSummary, LandingPageRow, PropertyTrafficRow } from "@/lib/conversion-events";

// Sunucu tarafında önceden hesaplanmış veriyi gösteren salt-okunur panel (GoogleVisibilityPanel ile
// aynı desen) - hiçbir sayı asla client-side tahmin edilmez, D1'de gerçekten kayıtlı olmayan bir event
// GÖSTERİLMEZ (0 gösterilir, uydurulmaz). Dış API'lerin sunmadığı sosyal erişim/reach sayıları
// ASLA uydurulmaz - burada yalnız kendi D1'imizdeki gerçek tıklama/görüntüleme sayıları var.
const EVENT_LABELS: Record<ConversionEventName, string> = {
  page_view: "Sayfa görüntüleme",
  whatsapp_click: "WhatsApp tıklaması",
  booking_click: "Tarih & fiyat tıklaması",
  contact_submit: "İletişim/rezervasyon talebi",
  instagram_click: "Instagram tıklaması",
  facebook_click: "Facebook tıklaması",
};

const EVENT_ORDER: ConversionEventName[] = ["page_view", "whatsapp_click", "booking_click", "contact_submit", "instagram_click", "facebook_click"];

export interface ConversionWindowData {
  windowLabel: string;
  totals: Record<ConversionEventName, number>;
  bySource: ConversionEventSummaryRow[];
  byProperty: PropertyTrafficRow[];
  topLandingPages: LandingPageRow[];
  conversionRate: ConversionRateSummary;
}

function StatCard({ label, value, color = "#f8fafc" }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ padding: "10px 12px", border: "1px solid #1e293b", borderRadius: 10, background: "#0f172a" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>{label}</div>
    </div>
  );
}

function WindowPanel({ data }: { data: ConversionWindowData }) {
  const topSources = data.bySource.filter((row) => row.utmSource).slice(0, 8);

  return (
    <div style={{ padding: "16px 18px", border: "1px solid #334155", borderRadius: 14, background: "#0b1220" }}>
      <small style={{ display: "block", color: "#94a3b8", fontSize: 10, letterSpacing: 1.5, marginBottom: 10 }}>
        DÖNÜŞÜM OLAYLARI · {data.windowLabel.toUpperCase()}
      </small>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        {EVENT_ORDER.map((eventName) => (
          <StatCard key={eventName} label={EVENT_LABELS[eventName]} value={data.totals[eventName] ?? 0} />
        ))}
        <StatCard label="Dönüşüm oranı (ziyaret → talep)" value={`%${data.conversionRate.ratePercent}`} color="#86efac" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div>
          <small style={{ display: "block", color: "#94a3b8", fontSize: 10, letterSpacing: 1.5, marginBottom: 8 }}>UTM KAYNAĞINA GÖRE</small>
          {topSources.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {topSources.map((row) => (
                  <tr key={`${row.eventName}-${row.utmSource}`} style={{ borderTop: "1px solid #1e293b" }}>
                    <td style={{ padding: "6px 4px", color: "#f8fafc" }}>{row.utmSource}</td>
                    <td style={{ padding: "6px 4px", color: "#94a3b8" }}>{EVENT_LABELS[row.eventName]}</td>
                    <td style={{ padding: "6px 4px", color: "#f8fafc", textAlign: "right", fontWeight: 700 }}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Henüz UTM kaynaklı kayıt yok.</p>}
        </div>

        <div>
          <small style={{ display: "block", color: "#94a3b8", fontSize: 10, letterSpacing: 1.5, marginBottom: 8 }}>VİLLAYA GÖRE (mülk)</small>
          {data.byProperty.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {data.byProperty.slice(0, 8).map((row) => (
                  <tr key={`${row.villa}-${row.eventName}`} style={{ borderTop: "1px solid #1e293b" }}>
                    <td style={{ padding: "6px 4px", color: "#f8fafc" }}>Villa {row.villa}</td>
                    <td style={{ padding: "6px 4px", color: "#94a3b8" }}>{EVENT_LABELS[row.eventName]}</td>
                    <td style={{ padding: "6px 4px", color: "#f8fafc", textAlign: "right", fontWeight: 700 }}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Henüz villaya atfedilen kayıt yok.</p>}
        </div>

        <div>
          <small style={{ display: "block", color: "#94a3b8", fontSize: 10, letterSpacing: 1.5, marginBottom: 8 }}>EN ÇOK GÖRÜNTÜLENEN SAYFALAR</small>
          {data.topLandingPages.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {data.topLandingPages.slice(0, 8).map((row) => (
                  <tr key={row.landingPath} style={{ borderTop: "1px solid #1e293b" }}>
                    <td style={{ padding: "6px 4px", color: "#f8fafc" }}>{row.landingPath}</td>
                    <td style={{ padding: "6px 4px", color: "#f8fafc", textAlign: "right", fontWeight: 700 }}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Henüz sayfa görüntüleme kaydı yok.</p>}
        </div>
      </div>
    </div>
  );
}

export default function ConversionEventsPanel({ windows }: { windows: ConversionWindowData[] }) {
  return (
    <section style={{ maxWidth: 1250, margin: "12px auto", padding: "0 20px", display: "grid", gap: 12 }}>
      {windows.map((data) => <WindowPanel key={data.windowLabel} data={data} />)}
    </section>
  );
}
