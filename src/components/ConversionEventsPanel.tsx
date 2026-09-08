import type { ConversionEventName, ConversionEventSummaryRow } from "@/lib/conversion-events";

// Sunucu tarafında önceden hesaplanmış veriyi gösteren salt-okunur panel (GoogleVisibilityPanel ile
// aynı desen) - hiçbir sayı asla client-side tahmin edilmez, D1'de gerçekten kayıtlı olmayan bir event
// GÖSTERİLMEZ (0 gösterilir, uydurulmaz).
const EVENT_LABELS: Record<ConversionEventName, string> = {
  page_view: "Sayfa görüntüleme",
  whatsapp_click: "WhatsApp tıklaması",
  booking_click: "Tarih & fiyat tıklaması",
  contact_submit: "İletişim/rezervasyon talebi",
  instagram_click: "Instagram tıklaması",
  facebook_click: "Facebook tıklaması",
};

const EVENT_ORDER: ConversionEventName[] = ["page_view", "whatsapp_click", "booking_click", "contact_submit", "instagram_click", "facebook_click"];

export default function ConversionEventsPanel({
  totals,
  bySource,
  windowLabel,
}: {
  totals: Record<ConversionEventName, number>;
  bySource: ConversionEventSummaryRow[];
  windowLabel: string;
}) {
  const topSources = bySource.filter((row) => row.utmSource).slice(0, 8);

  return (
    <section style={{ maxWidth: 1250, margin: "12px auto", padding: "0 20px" }}>
      <div style={{ padding: "16px 18px", border: "1px solid #334155", borderRadius: 14, background: "#0b1220" }}>
        <small style={{ display: "block", color: "#94a3b8", fontSize: 10, letterSpacing: 1.5, marginBottom: 10 }}>
          DÖNÜŞÜM OLAYLARI · {windowLabel.toUpperCase()}
        </small>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: topSources.length ? 16 : 0 }}>
          {EVENT_ORDER.map((eventName) => (
            <div key={eventName} style={{ padding: "10px 12px", border: "1px solid #1e293b", borderRadius: 10, background: "#0f172a" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f8fafc" }}>{totals[eventName] ?? 0}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{EVENT_LABELS[eventName]}</div>
            </div>
          ))}
        </div>
        {topSources.length > 0 && (
          <div>
            <small style={{ display: "block", color: "#94a3b8", fontSize: 10, letterSpacing: 1.5, marginBottom: 8 }}>
              UTM KAYNAĞINA GÖRE (utm_source)
            </small>
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
          </div>
        )}
        {topSources.length === 0 && (
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
            Henüz UTM kaynaklı bir dönüşüm kaydı yok. Sosyal medya gönderilerindeki UTM&apos;li linkler tıklandıkça burada görünecek.
          </p>
        )}
      </div>
    </section>
  );
}
