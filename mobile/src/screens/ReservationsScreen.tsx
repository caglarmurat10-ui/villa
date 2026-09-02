import { useState } from "react";
import { Link } from "react-router-dom";
import { TopBar, Skeleton, ErrorState, EmptyState } from "../components/common";
import { useApi } from "../lib/useApi";

interface Reservation {
  id: string; villa: "Safira" | "Destan"; guestName: string; phone: string;
  checkIn: string; checkOut: string; totalAmount: number; paidAmount: number; channel: string;
}

export function ReservationsScreen() {
  const [villa, setVilla] = useState<"" | "Safira" | "Destan">("");
  const [search, setSearch] = useState("");
  const query = new URLSearchParams();
  if (villa) query.set("villa", villa);
  if (search.trim()) query.set("search", search.trim());
  const path = `/reservations${query.toString() ? `?${query}` : ""}`;
  const { data, loading, error, reload } = useApi<{ reservations: Reservation[] }>(path, [villa, search]);

  return (
    <div>
      <TopBar title="Rezervasyonlar" right={<Link to="/rezervasyonlar/yeni" className="btn" style={{ minHeight: 36, padding: "0 12px", fontSize: 12 }}>+ Yeni</Link>} />
      <div className="app-content">
        <input className="input" placeholder="Misafir adı veya telefon ara…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["", "Safira", "Destan"] as const).map((v) => (
            <button key={v || "all"} className="btn" style={{ flex: 1, background: villa === v ? "#d5aa58" : undefined, color: villa === v ? "#1a1408" : undefined }} onClick={() => setVilla(v)}>
              {v || "Tümü"}
            </button>
          ))}
        </div>

        {loading && <Skeleton count={5} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data && data.reservations.length === 0 && <EmptyState text="Rezervasyon bulunamadı." />}
        {data?.reservations.map((r) => (
          <Link className="list-item" to={`/rezervasyonlar/${r.id}`} key={r.id}>
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>{r.guestName}</b>
                <span style={{ fontSize: 11, color: "#9fb0c5" }}>Villa {r.villa}</span>
              </div>
              <div style={{ fontSize: 12, color: "#9fb0c5", marginTop: 4 }}>{r.checkIn} → {r.checkOut}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{r.paidAmount.toLocaleString("tr-TR")}₺ / {r.totalAmount.toLocaleString("tr-TR")}₺ ödendi</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
