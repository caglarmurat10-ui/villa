import { useMemo, useState } from "react";
import { TopBar, Skeleton, ErrorState } from "../components/common";
import { BottomSheet } from "../components/BottomSheet";
import { useApi } from "../lib/useApi";
import { openWhatsApp, openPhone } from "../lib/deeplinks";
import { normalizeWhatsAppNumber } from "../lib/messageTemplates";
import {
  buildMonthGrid, monthLabel, weekdayLabels, addMonths, currentCursor, todayISO, isNightOccupied,
  type MonthCursor,
} from "../lib/calendarMonth";

type VillaName = "Safira" | "Destan";

interface CalendarEntry {
  id?: string;
  villa: VillaName;
  guestName?: string;
  phone?: string;
  checkIn: string;
  checkOut: string;
  channel?: string;
  notes?: string;
  totalAmount?: number;
  paidAmount?: number;
  source: string;
  confidence: "confirmed" | "needs_review";
}
interface CalendarData { reservations: CalendarEntry[]; otaBlocks: CalendarEntry[]; }

const SOURCE_LABELS: Record<string, string> = {
  direct: "Doğrudan", airbnb: "Airbnb", booking: "Booking", manual: "Manuel",
};

function villaClass(villa: VillaName): string {
  return villa === "Safira" ? "villa-safira" : "villa-destan";
}

export function CalendarScreen() {
  const [villa, setVilla] = useState<"" | VillaName>("");
  const [cursor, setCursor] = useState<MonthCursor>(currentCursor());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const path = `/calendar${villa ? `?villa=${villa}` : ""}`;
  const { data, loading, error, reload } = useApi<CalendarData>(path, [villa]);

  const entries: CalendarEntry[] = useMemo(
    () => (data ? [...data.reservations, ...data.otaBlocks] : []),
    [data],
  );

  const weeks = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const today = todayISO();

  function entriesForDate(date: string): CalendarEntry[] {
    return entries.filter((e) => isNightOccupied(date, e.checkIn, e.checkOut) || e.checkIn === date || e.checkOut === date);
  }

  const selectedEntries = selectedDate ? entriesForDate(selectedDate) : [];

  async function sendWhatsApp(entry: CalendarEntry) {
    if (!entry.phone) return;
    await openWhatsApp(`https://wa.me/${normalizeWhatsAppNumber(entry.phone)}`);
  }

  return (
    <div>
      <TopBar title="Takvim" />
      <div className="app-content">
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["", "Safira", "Destan"] as const).map((v) => (
            <button key={v || "both"} className="btn" style={{ flex: 1, background: villa === v ? "#d5aa58" : undefined, color: villa === v ? "#1a1408" : undefined }} onClick={() => setVilla(v)}>
              {v || "Tümü"}
            </button>
          ))}
        </div>

        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Önceki ay">‹</button>
          <div className="cal-nav-label">{monthLabel(cursor)}</div>
          <button className="cal-nav-btn" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Sonraki ay">›</button>
          <button className="cal-today-btn" onClick={() => setCursor(currentCursor())}>Bugün</button>
        </div>

        <div className="cal-legend">
          <span className="cal-legend-item"><span className="cal-legend-swatch" style={{ background: "var(--villa-safira)" }} />Safira</span>
          <span className="cal-legend-item"><span className="cal-legend-swatch" style={{ background: "var(--villa-destan)" }} />Destan</span>
          <span className="cal-legend-item"><span className="cal-legend-swatch needs-review" />Kontrol gerekli</span>
          <span className="cal-legend-item">↓ Giriş</span>
          <span className="cal-legend-item">↑ Çıkış</span>
        </div>

        {loading && <Skeleton count={3} />}
        {error && <ErrorState text={error} onRetry={reload} />}

        {data && (
          <>
            <div className="cal-weekday-row">
              {weekdayLabels().map((w) => <div key={w} className="cal-weekday">{w}</div>)}
            </div>
            <div className="cal-grid">
              {weeks.flat().map((cell) => {
                const dayEntries = entriesForDate(cell.date);
                const hasCheckIn = dayEntries.some((e) => e.checkIn === cell.date);
                const hasCheckOut = dayEntries.some((e) => e.checkOut === cell.date);
                const hasReview = dayEntries.some((e) => e.confidence === "needs_review");
                const villasPresent = Array.from(new Set(dayEntries.map((e) => e.villa)));

                return (
                  <button
                    type="button"
                    key={cell.date}
                    className={`cal-cell ${cell.inMonth ? "" : "out-month"} ${cell.date === today ? "is-today" : ""} ${dayEntries.length ? "has-events" : ""}`}
                    onClick={() => dayEntries.length && setSelectedDate(cell.date)}
                    disabled={dayEntries.length === 0}
                  >
                    <div className="cal-daynum">{cell.dayNum}</div>
                    <div className="cal-bars">
                      {villasPresent.map((v) => {
                        const vEntries = dayEntries.filter((e) => e.villa === v);
                        const isReviewOnly = vEntries.every((e) => e.confidence === "needs_review");
                        const isIn = vEntries.some((e) => e.checkIn === cell.date);
                        const isOut = vEntries.some((e) => e.checkOut === cell.date && e.checkOut !== e.checkIn);
                        const cls = ["cal-bar", isReviewOnly ? "needs-review" : villaClass(v), isIn ? "checkin" : "", isOut && !isIn ? "checkout" : ""].join(" ").trim();
                        return <div key={v} className={cls} />;
                      })}
                    </div>
                    {hasCheckIn && <span className="cal-badge cal-badge-in">↓</span>}
                    {hasCheckOut && <span className="cal-badge cal-badge-out">↑</span>}
                    {hasReview && <span className="cal-badge cal-badge-review">?</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <BottomSheet open={!!selectedDate} onClose={() => setSelectedDate(null)} title={selectedDate ?? ""}>
        {selectedEntries.map((entry, i) => {
          const nights = Math.round((new Date(entry.checkOut).getTime() - new Date(entry.checkIn).getTime()) / 86400000);
          const isIn = entry.checkIn === selectedDate;
          const isOut = entry.checkOut === selectedDate;
          return (
            <div className={`sheet-entry ${entry.confidence === "needs_review" ? "needs-review" : ""}`} key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <b>Villa {entry.villa}</b>
                {entry.confidence === "needs_review"
                  ? <span className="badge badge-warning">Kontrol gerekli</span>
                  : <span className="badge badge-success">Onaylı</span>}
              </div>
              <div style={{ fontSize: 12, color: "#9fb0c5", marginTop: 4 }}>
                Kaynak: {SOURCE_LABELS[entry.source] ?? entry.channel ?? entry.source}
                {entry.channel && entry.source === "direct" && entry.channel !== "Doğrudan" ? ` (${entry.channel})` : ""}
              </div>
              <div style={{ fontSize: 13, marginTop: 8 }}>
                {entry.checkIn} → {entry.checkOut} · {nights} gece
              </div>
              <div style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 10 }}>
                {isIn && <span style={{ color: "#86efac" }}>↓ Bugün giriş</span>}
                {isOut && <span style={{ color: "#fbbf24" }}>↑ Bugün çıkış</span>}
              </div>
              {entry.confidence === "needs_review" && (
                <p style={{ fontSize: 11, color: "#fbbf24", marginTop: 8 }}>
                  Bu kayıt OTA kaynaklı, henüz kesin doğrulanmamış bir bloktur — kesin rezervasyon gibi değerlendirilmemelidir.
                </p>
              )}
              {typeof entry.totalAmount === "number" && (
                <div style={{ fontSize: 12, marginTop: 8 }}>
                  {(entry.paidAmount ?? 0).toLocaleString("tr-TR")}₺ / {entry.totalAmount.toLocaleString("tr-TR")}₺ ödendi
                </div>
              )}
              {entry.guestName && <div style={{ fontSize: 13, marginTop: 8 }}>{entry.guestName}</div>}
              {entry.notes && <div style={{ fontSize: 12, color: "#9fb0c5", marginTop: 6 }}>{entry.notes}</div>}
              {entry.phone && (
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn" style={{ flex: 1 }} onClick={() => sendWhatsApp(entry)}>WhatsApp Aç</button>
                  <button className="btn" style={{ flex: 1 }} onClick={() => openPhone(normalizeWhatsAppNumber(entry.phone!))}>Ara</button>
                </div>
              )}
              {entry.id && (
                <a className="list-item" href={`#/rezervasyonlar/${entry.id}`} style={{ display: "block", marginTop: 10, fontSize: 12, color: "#93c5fd" }}>
                  Rezervasyon detayına git →
                </a>
              )}
            </div>
          );
        })}
      </BottomSheet>
    </div>
  );
}
