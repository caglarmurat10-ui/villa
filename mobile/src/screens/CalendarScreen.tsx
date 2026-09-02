import { useState } from "react";
import { TopBar, Skeleton, ErrorState, EmptyState, Badge } from "../components/common";
import { useApi } from "../lib/useApi";

interface CalendarEntry { villa: string; guestName?: string; checkIn: string; checkOut: string; source: string; confidence: "confirmed" | "needs_review"; }
interface CalendarData { reservations: CalendarEntry[]; otaBlocks: CalendarEntry[]; }

export function CalendarScreen() {
  const [villa, setVilla] = useState<"" | "Safira" | "Destan">("");
  const path = `/calendar${villa ? `?villa=${villa}` : ""}`;
  const { data, loading, error, reload } = useApi<CalendarData>(path, [villa]);

  const combined = data ? [...data.reservations, ...data.otaBlocks].sort((a, b) => a.checkIn.localeCompare(b.checkIn)) : [];

  return (
    <div>
      <TopBar title="Takvim" />
      <div className="app-content">
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["", "Safira", "Destan"] as const).map((v) => (
            <button key={v || "both"} className="btn" style={{ flex: 1, background: villa === v ? "#d5aa58" : undefined, color: villa === v ? "#1a1408" : undefined }} onClick={() => setVilla(v)}>
              {v || "İkisi Birlikte"}
            </button>
          ))}
        </div>

        {loading && <Skeleton count={5} />}
        {error && <ErrorState text={error} onRetry={reload} />}
        {data && combined.length === 0 && <EmptyState text="Görünen tarih aralığında kayıt yok." />}
        {combined.map((entry, i) => (
          <div className="card" key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <b>{entry.guestName ?? entry.source}</b>
                <div style={{ fontSize: 11, color: "#9fb0c5" }}>Villa {entry.villa}</div>
              </div>
              {entry.confidence === "needs_review"
                ? <Badge tone="warning">İncelenmeli</Badge>
                : <Badge tone="success">Onaylı</Badge>}
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>{entry.checkIn} → {entry.checkOut}</div>
          </div>
        ))}
        <p style={{ fontSize: 10, color: "#6b7787", marginTop: 12 }}>
          "İncelenmeli" olarak işaretli kayıtlar OTA (Airbnb/Booking) kaynaklı, henüz kesin doğrulanmamış bloklardır — kesin rezervasyon gibi değerlendirilmemelidir.
        </p>
      </div>
    </div>
  );
}
