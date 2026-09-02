import { Link } from "react-router-dom";
import { Skeleton, ErrorState } from "../components/common";
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
  { to: "/takvim", label: "Takvim", icon: "📅" },
  { to: "/mesajlar", label: "Mesajlar", icon: "💬" },
  { to: "/rezervasyonlar", label: "Rezervasyonlar", icon: "📋" },
];

function todayLabel(): string {
  return new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

function GuestRow({ r, kind }: { r: ReservationLite; kind: "location" | "checkout" }) {
  const remaining = r.totalAmount - r.paidAmount;
  return (
    <div className="card">
      <b style={{ fontSize: 15 }}>{r.guestName}</b>
      <div style={{ fontSize: 12, color: "#9fb0c5", marginTop: 2 }}>Villa {r.villa} · {r.checkIn} → {r.checkOut}</div>
      {remaining > 0 && <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 2 }}>Kalan: {remaining.toLocaleString("tr-TR")}₺</div>}
      <Link to={`/mesajlar?villa=${r.villa}&type=${kind}`} className="btn btn-block" style={{ fontSize: 13, minHeight: 40, marginTop: 10 }}>Mesaj Hazırla</Link>
    </div>
  );
}

export function DashboardScreen() {
  const { data, loading, error, reload } = useApi<DashboardData>("/dashboard");

  return (
    <div className="app-content" style={{ paddingTop: "calc(20px + var(--safe-top))" }}>
      <div className="hero">
        <div className="hero-eyebrow">VILLA YÖNETİM</div>
        <div className="hero-subtitle" style={{ textTransform: "capitalize" }}>{todayLabel()}</div>
      </div>

      <Link to="/rezervasyonlar/yeni" className="btn btn-primary btn-block btn-hero" style={{ marginBottom: 10 }}>
        + Yeni Rezervasyon
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 4 }}>
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.to} to={a.to} className="list-item">
            <div className="card" style={{ textAlign: "center", padding: "14px 6px", marginBottom: 0 }}>
              <div style={{ fontSize: 22 }}>{a.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4 }}>{a.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {loading && <Skeleton count={4} />}
      {error && <ErrorState text={error} onRetry={reload} />}
      {data && (
        <>
          <div className="section-heading">Bugün</div>
          {data.checkInsToday.length === 0 && data.checkOutsToday.length === 0 && (
            <div className="card"><p style={{ margin: 0, fontSize: 13, color: "#9fb0c5" }}>Bugün giriş veya çıkış yok.</p></div>
          )}
          {data.checkInsToday.map((r) => <GuestRow key={r.id} r={r} kind="location" />)}
          {data.checkOutsToday.map((r) => <GuestRow key={r.id} r={r} kind="checkout" />)}

          {data.upcomingReservations.length > 0 && (
            <>
              <div className="section-heading">Yaklaşan</div>
              {data.upcomingReservations.slice(0, 4).map((r) => (
                <Link className="list-item" to={`/rezervasyonlar/${r.id}`} key={r.id}>
                  <div className="card">
                    <b style={{ fontSize: 14 }}>{r.guestName}</b> · Villa {r.villa}
                    <div style={{ fontSize: 12, color: "#9fb0c5", marginTop: 4 }}>{r.checkIn} → {r.checkOut}</div>
                  </div>
                </Link>
              ))}
            </>
          )}

          {(data.otaNeedsReview.count > 0 || data.social.destanInstagramHardBlocked) && (
            <>
              <div className="section-heading">Uyarılar</div>
              {data.otaNeedsReview.count > 0 && (
                <div className="card" style={{ borderColor: "#a16207" }}>
                  <p style={{ fontSize: 13, margin: 0 }}>⚠ {data.otaNeedsReview.count} OTA bloğu incelenmeyi bekliyor.</p>
                </div>
              )}
              {data.social.destanInstagramHardBlocked && (
                <div className="card" style={{ borderColor: "#a16207" }}>
                  <p style={{ fontSize: 13, margin: 0 }}>🔒 Destan Instagram yayını bağlantı sorunu nedeniyle kapalı.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
