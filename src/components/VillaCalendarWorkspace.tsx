"use client";

import { useMemo, useState } from "react";
import type { Reservation, Villa, VillaLocations } from "@/lib/types";
import type { AdminExternalBlock } from "@/lib/ota/types";

const villas: Villa[] = ["Safira", "Destan"];
const SOURCE_LABEL: Record<AdminExternalBlock["source"], string> = { airbnb: "Airbnb", booking: "Booking.com", manual: "Manuel blok" };
const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function trDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "short" }).format(new Date(`${value}T12:00:00`));
}
function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.length === 10) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `90${digits.slice(1)}`;
  return digits;
}
function whatsappUrl(phone: string, text: string) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
}
function guestMessage(item: Reservation, type: "Giriş" | "Çıkış", locations: VillaLocations) {
  if (type === "Giriş") return `Merhaba 👋\n\n${item.villa} Villa rezervasyonunuz için sizi ağırlamaktan mutluluk duyacağız.\n\n📍 ${item.villa} Villa konumu:\n${locations[item.villa]}\n\n🕓 Giriş saatimiz 16.00’dır.\n\nVillaya sorunsuz şekilde giriş yapabilmeniz için konuma yaklaşık 15 dakika kala bize haber vermenizi rica ederiz.\n\nŞimdiden iyi yolculuklar dileriz.`;
  return `Merhaba 👋\n\nBizi tercih ettiğiniz için teşekkür ederiz.\n\n🧳 Çıkış saatimiz 10.00’dır.\n\nÇıkış saatinizde villada olacağız ve çıkış işlemlerini birlikte tamamlayacağız.\n\nGüzel anılarla ayrılmanızı diler, sizi yeniden ağırlamaktan memnuniyet duyarız.`;
}

function VillaMonth({ villa, reservations, externalBlocks, year, month }: { villa: Villa; reservations: Reservation[]; externalBlocks: AdminExternalBlock[]; year: number; month: number }) {
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  const villaRows = reservations.filter((item) => item.villa === villa);
  const villaBlocks = externalBlocks.filter((item) => item.villa === villa);

  return <section className={`villa-month villa-${villa.toLowerCase()}`}>
    <div className="villa-month-title"><div className="villa-calendar-mark">{villa[0]}</div><div><strong>Villa {villa}</strong><span>{villaRows.filter((r) => r.checkIn.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`).length} giriş</span></div></div>
    <div className="villa-calendar-grid">
      {weekdays.map((day) => <b className="villa-weekday" key={day}>{day}</b>)}
      {Array.from({ length: offset }, (_, index) => <span className="villa-empty-day" key={`empty-${index}`} />)}
      {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
        const date = isoDate(year, month, day);
        const stays = villaRows.filter((r) => r.checkIn <= date && r.checkOut > date);
        const arrivals = villaRows.filter((r) => r.checkIn === date);
        const departures = villaRows.filter((r) => r.checkOut === date);
        const blocksToday = villaBlocks.filter((b) => b.startDate <= date && b.endDate > date);
        return <article className={`villa-day ${date === today ? "today" : ""} ${stays.length || blocksToday.length ? "occupied" : ""}`} key={date}>
          <strong>{day}</strong>
          {arrivals.map((r) => <span className="day-event arrival" key={`a-${r.id}`}>→ {r.guestName}</span>)}
          {stays.filter((r) => !arrivals.some((a) => a.id === r.id)).slice(0, 2).map((r) => <span className="day-event stay" key={`s-${r.id}`}>{r.guestName}</span>)}
          {departures.map((r) => <span className="day-event departure" key={`d-${r.id}`}>← {r.guestName}</span>)}
          {blocksToday.map((b, index) => (
            <span
              className={`day-event ${b.status === "needs_review" ? "conflict" : "external"}`}
              key={`b-${b.source}-${b.startDate}-${index}`}
              title={b.status === "needs_review" ? `Çakışma: ${SOURCE_LABEL[b.source]} — bu tarih Airbnb/Booking üzerinden yönetiliyor olabilir, kontrol edin.` : `Bu tarih ${SOURCE_LABEL[b.source]} üzerinden yönetiliyor.`}
            >
              {b.status === "needs_review" ? "⚠ " : ""}{SOURCE_LABEL[b.source]}
            </span>
          ))}
        </article>;
      })}
    </div>
  </section>;
}

export default function VillaCalendarWorkspace({ reservations, locations, externalBlocks }: { reservations: Reservation[]; locations: VillaLocations; externalBlocks: AdminExternalBlock[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthTitle = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(cursor);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const events = useMemo(() => reservations.flatMap((reservation) => {
    const result: { date: string; type: "Giriş" | "Çıkış"; reservation: Reservation }[] = [];
    if (reservation.checkIn.startsWith(monthPrefix)) result.push({ date: reservation.checkIn, type: "Giriş", reservation });
    if (reservation.checkOut.startsWith(monthPrefix)) result.push({ date: reservation.checkOut, type: "Çıkış", reservation });
    return result;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.reservation.villa.localeCompare(b.reservation.villa)), [reservations, monthPrefix]);

  return <div className="villa-calendar-workspace">
    <header className="calendar-workspace-head">
      <div><span className="ops-eyebrow">AYRI VİLLA TAKVİMLERİ</span><h1>Takvim ve günlük işlemler</h1><p>Safira ve Destan birbirinden ayrıdır; doluluk, giriş ve çıkışlar aynı ay içinde karşılaştırılır ama karışmaz.</p></div>
      <div className="calendar-month-nav"><button onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button><strong>{monthTitle}</strong><button onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button></div>
    </header>

    <div className="villa-calendar-pair">{villas.map((villa) => <VillaMonth key={villa} villa={villa} reservations={reservations} externalBlocks={externalBlocks} year={year} month={month} />)}</div>

    <section className="calendar-operations">
      <div className="calendar-operations-head"><div><span className="ops-eyebrow">AYLIK İŞLEM LİSTESİ</span><h2>Giriş ve çıkış aksiyonları</h2></div><b>{events.length} işlem</b></div>
      {events.length === 0 ? <div className="ops-empty">Bu ay giriş veya çıkış işlemi yok.</div> : <div className="calendar-operation-list">{events.map((event) => {
        const item = event.reservation;
        const disabled = !normalizePhone(item.phone) || (event.type === "Giriş" && !locations[item.villa]);
        return <article key={`${item.id}-${event.type}`} className={`calendar-operation ${event.type === "Giriş" ? "arrival" : "departure"}`}>
          <div className="calendar-operation-date"><strong>{trDate(event.date)}</strong><span>{event.type}</span></div>
          <div className="calendar-operation-guest"><b>Villa {item.villa}</b><strong>{item.guestName}</strong><span>{item.phone || "WhatsApp numarası yok"}</span></div>
          <div className="calendar-operation-actions">{disabled ? <span className="operation-warning">{!item.phone ? "Numara eksik" : "Konum eksik"}</span> : <a href={whatsappUrl(item.phone, guestMessage(item, event.type, locations))} target="_blank" rel="noreferrer">WhatsApp'ta aç</a>}</div>
        </article>;
      })}</div>}
    </section>
  </div>;
}
