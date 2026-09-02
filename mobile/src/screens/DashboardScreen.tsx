import { Link } from "react-router-dom";
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
interface ReservationLite {
  id: string; villa: string; guestName: string; phone: string; checkIn: string; checkOut: string;
  totalAmount: number; paidAmount: number;
}

const QUICK_ACTIONS = [
  { to: "/rezervasyonlar/yeni", label: "+ Yeni Rezervasyon", icon: "🆕" },
  { to: "/mesajlar", label: "WhatsApp Mesajları", icon: "💬" },
  { to: "/takvim", label: "Takvim", icon: "📅" },
  { to: "/rezervasyonlar", label: "Rezervasyonlar", icon: "📋" },
];

function GuestActionCard({ r, kind }: { r: ReservationLite; kind: "location" | "checkout" }) {
  const remaining = r.totalAmount - r.paidAmount;
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <b>{r.guestName}</b>
          <div style={{ fontSize: 11, color: "#9fb0c5" }}>Villa {r.villa} · {r.checkIn} → {r.checkOut}</div>
          {remaining > 0 && <div style={{ fontSize: 11, color: "#fbbf24", marginTop: 2 }}>Kalan: {remaining.toLocaleString("tr-TR")}₺</div>}
        </div>
        <Link to={`/mesajlar?villa=${r.villa}&type=${kind}`} className="btn" style={{ fontSize: 12, minHeight: 36 }}>Mesaj Hazırla</Link>
      </div>
    </div>
  );
}

export function DashboardScreen() {
  const { data, loading, error, reload } = useApi<DashboardData>("/dashboard");

  return (
    <div>
      <TopBar title="Ana Sayfa" />
      <div className="app-content">
        <div className="section-heading" style={{ marginTop: 0, fontSize: 13 }}>Hızlı İşlemler</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.to} to={a.to} className="list-item">
              <div className="card" style={{ textAlign: "center", padding: "18px 10px" }}>
                <div style={{ fontSize: 26 }}>{a.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>{a.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {loading && <Skeleton count={4} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data && (
          <>
            {data.checkInsToday.length > 0 && (
              <>
                <div className="section-heading">Bugün Giriş</div>
                {data.checkInsToday.map((r) => <GuestActionCard key={r.id} r={r} kind="location" />)}
              </>
            )}
            {data.checkOutsToday.length > 0 && (
              <>
                <div className="section-heading">Bugün Çıkış</div>
                {data.checkOutsToday.map((r) => <GuestActionCard key={r.id} r={r} kind="checkout" />)}
              </>
            )}
            {data.checkInsToday.length === 0 && data.checkOutsToday.length === 0 && (
              <div className="card"><p style={{ margin: 0, fontSize: 12, color: "#9fb0c5" }}>Bugün giriş veya çıkış yok.</p></div>
            )}

            {data.upcomingReservations.length > 0 && (
              <>
                <div className="section-heading">Yaklaşan Rezervasyonlar</div>
                {data.upcomingReservations.slice(0, 5).map((r) => (
                  <Link className="list-item" to={`/rezervasyonlar/${r.id}`} key={r.id}>
                    <div className="card">
                      <b>{r.guestName}</b> · Villa {r.villa}
                      <div style={{ fontSize: 11, color: "#9fb0c5", marginTop: 4 }}>{r.checkIn} → {r.checkOut}</div>
                    </div>
                  </Link>
                ))}
              </>
            )}

            {(data.otaNeedsReview.count > 0 || data.social.destanInstagramHardBlocked) && (
              <div className="section-heading">Uyarılar</div>
            )}
            {data.otaNeedsReview.count > 0 && (
              <div className="card" style={{ borderColor: "#a16207" }}>
                <div className="card-title" style={{ color: "#fbbf24" }}>⚠ OTA İNCELEME GEREKİYOR</div>
                <p style={{ fontSize: 12, margin: "6px 0 0" }}>{data.otaNeedsReview.count} blok, güvenilirliği doğrulanmamış (Airbnb/Booking).</p>
              </div>
            )}
            {data.social.destanInstagramHardBlocked && (
              <div className="card" style={{ borderColor: "#a16207" }}>
                <div className="card-title" style={{ color: "#fbbf24" }}>DESTAN INSTAGRAM</div>
                <p style={{ fontSize: 12, margin: "6px 0 0" }}>🔒 HARD BLOCKED — Business Portfolio sorunu çözülene kadar otomatik/manuel yayın kapalı.</p>
              </div>
            )}

            <div className="section-heading">Sosyal Medya Durumu</div>
            <Link className="list-item" to="/sosyal">
              <div className="card">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Badge tone="neutral">Bugün planlı: {data.social.scheduledToday}</Badge>
                  <Badge tone="success">Bugün yayınlandı: {data.social.publishedToday}</Badge>
                  {data.social.failed > 0 && <Badge tone="danger">Başarısız: {data.social.failed}</Badge>}
                </div>
              </div>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
