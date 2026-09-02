import { TopBar, Skeleton, ErrorState, Badge } from "../components/common";
import { useApi } from "../lib/useApi";

interface DashboardData {
  today: string;
  checkInsToday: ReservationLite[];
  checkOutsToday: ReservationLite[];
  upcomingReservations: ReservationLite[];
  villaStatus: Record<"Safira" | "Destan", { activeReservations: number }>;
  social: { scheduledToday: number; publishedToday: number; failed: number; destanInstagramHardBlocked: boolean };
  otaNeedsReview: { count: number; blocks: { villa: string; source: string; startDate: string; endDate: string }[] };
}
interface ReservationLite { id: string; villa: string; guestName: string; checkIn: string; checkOut: string; }

export function DashboardScreen() {
  const { data, loading, error, reload } = useApi<DashboardData>("/dashboard");

  return (
    <div>
      <TopBar title="Ana Sayfa" />
      <div className="app-content">
        {loading && <Skeleton count={4} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data && (
          <>
            <div className="stat-grid">
              <div className="stat-box"><div className="value">{data.checkInsToday.length}</div><div className="label">Bugün Giriş</div></div>
              <div className="stat-box"><div className="value">{data.checkOutsToday.length}</div><div className="label">Bugün Çıkış</div></div>
              <div className="stat-box"><div className="value">{data.villaStatus.Safira.activeReservations}</div><div className="label">Safira Aktif Rezervasyon</div></div>
              <div className="stat-box"><div className="value">{data.villaStatus.Destan.activeReservations}</div><div className="label">Destan Aktif Rezervasyon</div></div>
            </div>

            {data.otaNeedsReview.count > 0 && (
              <div className="card" style={{ borderColor: "#a16207" }}>
                <div className="card-title" style={{ color: "#fbbf24" }}>⚠ OTA İNCELEME GEREKİYOR</div>
                <p style={{ fontSize: 12, margin: "6px 0 0" }}>{data.otaNeedsReview.count} blok, güvenilirliği doğrulanmamış (Airbnb/Booking).</p>
              </div>
            )}

            <div className="card" style={{ borderColor: "#a16207" }}>
              <div className="card-title" style={{ color: "#fbbf24" }}>DESTAN INSTAGRAM</div>
              <p style={{ fontSize: 12, margin: "6px 0 0" }}>🔒 HARD BLOCKED — Business Portfolio sorunu çözülene kadar otomatik/manuel yayın kapalı.</p>
            </div>

            <div className="section-heading">Sosyal Medya</div>
            <div className="card">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="neutral">Bugün planlı: {data.social.scheduledToday}</Badge>
                <Badge tone="success">Bugün yayınlandı: {data.social.publishedToday}</Badge>
                {data.social.failed > 0 && <Badge tone="danger">Başarısız: {data.social.failed}</Badge>}
              </div>
            </div>

            {data.checkInsToday.length > 0 && (
              <>
                <div className="section-heading">Bugün Giriş Yapacaklar</div>
                {data.checkInsToday.map((r) => (
                  <div className="card" key={r.id}>
                    <b>{r.guestName}</b> · Villa {r.villa}
                  </div>
                ))}
              </>
            )}

            {data.upcomingReservations.length > 0 && (
              <>
                <div className="section-heading">Yaklaşan Rezervasyonlar</div>
                {data.upcomingReservations.slice(0, 5).map((r) => (
                  <div className="card" key={r.id}>
                    <b>{r.guestName}</b> · Villa {r.villa}
                    <div style={{ fontSize: 11, color: "#9fb0c5", marginTop: 4 }}>{r.checkIn} → {r.checkOut}</div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
