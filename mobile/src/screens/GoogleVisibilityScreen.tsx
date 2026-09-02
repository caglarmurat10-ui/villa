import { TopBar, Skeleton, ErrorState, Badge } from "../components/common";
import { useApi } from "../lib/useApi";

interface Snapshot {
  sitemapUrls: string[]; jsonLdPages: string[];
  mapsLinkConfigured: Record<"Safira" | "Destan", boolean>;
  placesApiConfigured: boolean;
  reviewRequestUrlConfigured: Record<"Safira" | "Destan", boolean>;
  gbpState: string; reviewAutomationState: string; napPhone: string;
}

const STATE_LABEL: Record<string, string> = { GOOGLE_READY: "Hazır", WAITING_OWNER_ACCESS: "Sahiplik bekleniyor", WAITING_API_ACCESS: "API erişimi bekleniyor" };
const STATE_TONE: Record<string, "success" | "warning"> = { GOOGLE_READY: "success", WAITING_OWNER_ACCESS: "warning", WAITING_API_ACCESS: "warning" };

export function GoogleVisibilityScreen() {
  const { data, loading, error, reload } = useApi<{ snapshot: Snapshot }>("/google-visibility");

  return (
    <div>
      <TopBar title="Google Görünürlük" />
      <div className="app-content">
        {loading && <Skeleton count={4} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data && (
          <>
            <div className="stat-grid">
              <div className="stat-box"><div className="value">{data.snapshot.sitemapUrls.length}</div><div className="label">Sitemap URL</div></div>
              <div className="stat-box"><div className="value">{data.snapshot.jsonLdPages.length}</div><div className="label">JSON-LD Sayfa</div></div>
            </div>
            <div className="card">
              <div className="card-title">Google Business Profile</div>
              <div style={{ marginTop: 8 }}><Badge tone={STATE_TONE[data.snapshot.gbpState] ?? "warning"}>{STATE_LABEL[data.snapshot.gbpState] ?? data.snapshot.gbpState}</Badge></div>
            </div>
            <div className="card">
              <div className="card-title">Review Otomasyonu</div>
              <div style={{ marginTop: 8 }}><Badge tone={STATE_TONE[data.snapshot.reviewAutomationState] ?? "warning"}>{STATE_LABEL[data.snapshot.reviewAutomationState] ?? data.snapshot.reviewAutomationState}</Badge></div>
            </div>
            <div className="card">
              <div className="card-title">Maps Linki</div>
              <p style={{ fontSize: 12, margin: "8px 0 0" }}>Safira: {data.snapshot.mapsLinkConfigured.Safira ? "✓ Var" : "Yok"} · Destan: {data.snapshot.mapsLinkConfigured.Destan ? "✓ Var" : "Yok"}</p>
            </div>
            <div className="card">
              <div className="card-title">Google Places API</div>
              <p style={{ fontSize: 12, margin: "8px 0 0" }}>{data.snapshot.placesApiConfigured ? "✓ Yapılandırılmış" : "Yapılandırılmamış — credential eksik"}</p>
            </div>
            <div className="card">
              <div className="card-title">Yorum İsteme Linki</div>
              <p style={{ fontSize: 12, margin: "8px 0 0" }}>Safira: {data.snapshot.reviewRequestUrlConfigured.Safira ? "✓ Var" : "Yok"} · Destan: {data.snapshot.reviewRequestUrlConfigured.Destan ? "✓ Var" : "Yok"}</p>
            </div>
            <div className="card">
              <div className="card-title">NAP Telefon</div>
              <p style={{ fontSize: 12, margin: "8px 0 0" }}>{data.snapshot.napPhone}</p>
            </div>
            <div className="card">
              <div className="card-title">Search Console</div>
              <p style={{ fontSize: 12, margin: "8px 0 0", color: "#9fb0c5" }}>API bağlı değil — index sayısı bu yüzden gösterilmiyor.</p>
            </div>
            <div className="card">
              <div className="card-title">GA4</div>
              <p style={{ fontSize: 12, margin: "8px 0 0", color: "#9fb0c5" }}>Data API bağlı değil — site trafiği/lead istatistiği burada yok.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
