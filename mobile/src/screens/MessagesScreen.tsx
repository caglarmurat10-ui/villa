import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TopBar, Skeleton, ErrorState, EmptyState } from "../components/common";
import { useApi } from "../lib/useApi";
import { normalizeWhatsAppNumber, whatsappTemplateFor } from "../lib/messageTemplates";
import { openWhatsApp } from "../lib/deeplinks";
import { todayISO } from "../lib/calendarMonth";

interface Reservation {
  id: string; villa: "Safira" | "Destan"; guestName: string; phone: string;
  checkIn: string; checkOut: string; channel: string;
}

type TimeFilter = "" | "today" | "tomorrow";

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MessagesScreen() {
  const [villa, setVilla] = useState<"" | "Safira" | "Destan">("");
  const [time, setTime] = useState<TimeFilter>("");
  const query = villa ? `?villa=${villa}` : "";
  const { data, loading, error, reload } = useApi<{ reservations: Reservation[] }>(`/reservations${query}`, [villa]);

  const today = todayISO();
  const tomorrow = tomorrowISO();

  const filtered = useMemo(() => {
    if (!data) return [];
    const list = [...data.reservations].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    if (time === "today") return list.filter((r) => r.checkIn === today || r.checkOut === today);
    if (time === "tomorrow") return list.filter((r) => r.checkIn === tomorrow);
    return list;
  }, [data, time, today, tomorrow]);

  async function send(reservation: Reservation, kind: "confirmation" | "location" | "checkout" | "review") {
    const message = whatsappTemplateFor(kind, reservation);
    await openWhatsApp(`https://wa.me/${normalizeWhatsAppNumber(reservation.phone)}?text=${encodeURIComponent(message)}`);
  }

  return (
    <div>
      <TopBar title="Mesajlar" />
      <div className="app-content">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {(["", "Safira", "Destan"] as const).map((v) => (
            <button key={v || "all"} className="btn" style={{ flex: 1, background: villa === v ? "#d5aa58" : undefined, color: villa === v ? "#1a1408" : undefined }} onClick={() => setVilla(v)}>
              {v || "Tümü"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {([["", "Tümü"], ["today", "Bugün"], ["tomorrow", "Yarın"]] as const).map(([v, label]) => (
            <button key={v || "time-all"} className="btn" style={{ flex: 1, fontSize: 12, background: time === v ? "#d5aa58" : undefined, color: time === v ? "#1a1408" : undefined }} onClick={() => setTime(v)}>
              {label}
            </button>
          ))}
        </div>

        {loading && <Skeleton count={4} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data && filtered.length === 0 && <EmptyState text="Bu filtrede rezervasyon yok." />}

        {filtered.map((r) => (
          <div className="card" key={r.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <b>{r.guestName}</b>
                <div style={{ fontSize: 11, color: "#9fb0c5" }}>Villa {r.villa} · {r.channel}</div>
              </div>
              <Link to={`/rezervasyonlar/${r.id}`} style={{ fontSize: 11, color: "#93c5fd" }}>Detay →</Link>
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>{r.checkIn} → {r.checkOut}</div>
            {r.phone ? (
              <>
                <div style={{ fontSize: 11, color: "#9fb0c5", marginTop: 6 }}>{r.phone}</div>
                <div style={{ display: "grid", gap: 6, gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
                  <button className="btn" style={{ fontSize: 12 }} onClick={() => send(r, "confirmation")}>Rezervasyon Onayı</button>
                  <button className="btn" style={{ fontSize: 12 }} onClick={() => send(r, "location")}>Giriş &amp; Konum</button>
                  <button className="btn" style={{ fontSize: 12 }} onClick={() => send(r, "checkout")}>Çıkış</button>
                  <button className="btn" style={{ fontSize: 12 }} onClick={() => send(r, "review")}>Yorum İsteme</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "#6b7787", marginTop: 8 }}>Numara yok</div>
            )}
          </div>
        ))}
        {filtered.length > 0 && (
          <p style={{ fontSize: 10, color: "#6b7787", marginTop: 4 }}>WhatsApp açılır, mesaj hazır gelir — göndermek için siz onaylarsınız. Otomatik gönderim yapılmaz.</p>
        )}
      </div>
    </div>
  );
}
