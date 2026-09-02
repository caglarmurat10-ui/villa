import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TopBar, Skeleton, ErrorState, EmptyState } from "../components/common";
import { useApi } from "../lib/useApi";
import { todayISO } from "../lib/calendarMonth";

interface Reservation {
  id: string; villa: "Safira" | "Destan"; guestName: string; phone: string;
  checkIn: string; checkOut: string; totalAmount: number; paidAmount: number; channel: string;
}

type StatusFilter = "" | "active" | "upcoming" | "past";

export function ReservationsScreen() {
  const [villa, setVilla] = useState<"" | "Safira" | "Destan">("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [checkInFrom, setCheckInFrom] = useState("");
  const [checkOutTo, setCheckOutTo] = useState("");

  const query = new URLSearchParams();
  if (villa) query.set("villa", villa);
  if (search.trim()) query.set("search", search.trim());
  if (checkInFrom) query.set("from", checkInFrom);
  if (checkOutTo) query.set("to", checkOutTo);
  const path = `/reservations${query.toString() ? `?${query}` : ""}`;
  const { data, loading, error, reload } = useApi<{ reservations: Reservation[] }>(path, [villa, search, checkInFrom, checkOutTo]);

  const today = todayISO();
  const filtered = useMemo(() => {
    if (!data) return [];
    if (!status) return data.reservations;
    return data.reservations.filter((r) => {
      if (status === "active") return r.checkIn <= today && today < r.checkOut;
      if (status === "upcoming") return r.checkIn > today;
      return r.checkOut <= today;
    });
  }, [data, status, today]);

  const hasDateFilter = checkInFrom || checkOutTo;

  return (
    <div>
      <TopBar title="Rezervasyonlar" right={<Link to="/rezervasyonlar/yeni" className="btn btn-primary" style={{ minHeight: 36, padding: "0 12px", fontSize: 12 }}>+ Yeni</Link>} />
      <div className="app-content">
        <input className="input" placeholder="Misafir adı ara…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 10 }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {(["", "Safira", "Destan"] as const).map((v) => (
            <button key={v || "all"} className="btn" style={{ flex: 1, background: villa === v ? "#d5aa58" : undefined, color: villa === v ? "#1a1408" : undefined }} onClick={() => setVilla(v)}>
              {v || "Tümü"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {([["", "Tümü"], ["active", "Aktif"], ["upcoming", "Yaklaşan"], ["past", "Geçmiş"]] as const).map(([v, label]) => (
            <button key={v || "status-all"} className="btn" style={{ flex: 1, fontSize: 12, background: status === v ? "#d5aa58" : undefined, color: status === v ? "#1a1408" : undefined }} onClick={() => setStatus(v)}>
              {label}
            </button>
          ))}
        </div>

        <button type="button" className="btn" style={{ fontSize: 12, marginBottom: 10, color: "#93c5fd" }} onClick={() => setShowAdvanced((s) => !s)}>
          {showAdvanced ? "Gelişmiş filtreyi gizle ▲" : "Gelişmiş filtre (tarih) ▼"}
        </button>
        {showAdvanced && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
            <input type="date" className="input" style={{ flex: 1, fontSize: 12 }} value={checkInFrom} onChange={(e) => setCheckInFrom(e.target.value)} aria-label="Giriş tarihinden itibaren" />
            <span style={{ color: "#6b7787", fontSize: 12 }}>→</span>
            <input type="date" className="input" style={{ flex: 1, fontSize: 12 }} value={checkOutTo} onChange={(e) => setCheckOutTo(e.target.value)} aria-label="Çıkış tarihine kadar" />
            {hasDateFilter && (
              <button className="btn" style={{ minHeight: 40, padding: "0 10px", fontSize: 11 }} onClick={() => { setCheckInFrom(""); setCheckOutTo(""); }}>Temizle</button>
            )}
          </div>
        )}

        {loading && <Skeleton count={5} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data && filtered.length === 0 && <EmptyState text="Rezervasyon bulunamadı." />}
        {filtered.map((r) => (
          <div className="card" key={r.id}>
            <Link className="list-item" to={`/rezervasyonlar/${r.id}`}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b style={{ fontSize: 15 }}>{r.guestName}</b>
                <span style={{ fontSize: 12, color: "#9fb0c5" }}>Villa {r.villa}</span>
              </div>
              <div style={{ fontSize: 13, color: "#9fb0c5", marginTop: 5 }}>{r.checkIn} → {r.checkOut} · {r.channel}</div>
              <div style={{ fontSize: 13, marginTop: 5 }}>{r.paidAmount.toLocaleString("tr-TR")}₺ / {r.totalAmount.toLocaleString("tr-TR")}₺ ödendi</div>
            </Link>
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <Link to={`/rezervasyonlar/${r.id}`} className="btn" style={{ flex: 1, fontSize: 12, minHeight: 40, textAlign: "center" }}>Detay</Link>
              <Link to={`/rezervasyonlar/${r.id}/duzenle`} className="btn" style={{ flex: 1, fontSize: 12, minHeight: 40, textAlign: "center" }}>Düzenle</Link>
              <Link to={`/mesajlar?villa=${r.villa}`} className="btn" style={{ flex: 1, fontSize: 12, minHeight: 40, textAlign: "center" }}>Mesaj</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
