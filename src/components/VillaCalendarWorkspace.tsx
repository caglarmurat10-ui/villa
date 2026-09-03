"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Reservation, Villa, VillaLocations } from "@/lib/types";
import type { AdminExternalBlock } from "@/lib/ota/types";
import { evaluateOtaBlockAgainstSeason } from "@/lib/season-policy";

const villas: Villa[] = ["Safira", "Destan"];
const SOURCE_LABEL: Record<AdminExternalBlock["source"], string> = { airbnb: "Airbnb", booking: "Booking.com", manual: "Manuel blok" };
const weekdays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function trDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "short" }).format(new Date(`${value}T12:00:00`));
}
function nights(start: string, end: string) {
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 86400000));
}
function todayIstanbul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
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

type Selection = { kind: "reservation"; reservation: Reservation } | { kind: "block"; block: AdminExternalBlock; villa: Villa };

function DetailSheet({ selection, locations, onClose }: { selection: Selection; locations: VillaLocations; onClose: () => void }) {
  const today = todayIstanbul();

  if (selection.kind === "reservation") {
    const r = selection.reservation;
    const remaining = r.totalAmount - r.paidAmount;
    return <div className="calendar-sheet-backdrop" onClick={onClose}>
      <div className="calendar-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="calendar-sheet-head">
          <div><small>REZERVASYON</small><h2>Villa {r.villa} · {r.guestName}</h2></div>
          <button type="button" className="calendar-sheet-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        <div className="calendar-sheet-grid">
          <div>Villa<br /><b>{r.villa}</b></div>
          <div>Kaynak<br /><b>{r.channel}</b></div>
          <div>Misafir<br /><b>{r.guestName}</b></div>
          <div>Giriş<br /><b>{trDate(r.checkIn)}</b></div>
          <div>Çıkış<br /><b>{trDate(r.checkOut)}</b></div>
          <div>Gece<br /><b>{nights(r.checkIn, r.checkOut)}</b></div>
          <div>Durum<br /><b>{r.checkOut >= today ? "Aktif" : "Tamamlandı"}</b></div>
          <div>Ödeme<br /><b style={{ color: remaining > 0 ? "#fbbf24" : "#86efac" }}>{money.format(r.paidAmount)} / {money.format(r.totalAmount)}</b></div>
        </div>
        {r.notes ? <div className="calendar-sheet-notes"><small>Not</small><p>{r.notes}</p></div> : null}
        <div className="calendar-sheet-actions">
          {normalizePhone(r.phone) ? <a className="ops-button secondary" href={whatsappUrl(r.phone, guestMessage(r, r.checkIn >= today ? "Giriş" : "Çıkış", locations))} target="_blank" rel="noreferrer">WhatsApp&apos;ta aç</a> : null}
          <Link className="ops-button" href="/rezervasyonlar">Rezervasyon Detayı</Link>
        </div>
      </div>
    </div>;
  }

  const b = selection.block;
  return <div className="calendar-sheet-backdrop" onClick={onClose}>
    <div className="calendar-sheet" onClick={(event) => event.stopPropagation()}>
      <div className="calendar-sheet-head">
        <div><small>DIŞ KAYNAK</small><h2>Villa {selection.villa} · {SOURCE_LABEL[b.source]}</h2></div>
        <button type="button" className="calendar-sheet-close" onClick={onClose} aria-label="Kapat">✕</button>
      </div>
      <div className="calendar-sheet-grid">
        <div>Villa<br /><b>{selection.villa}</b></div>
        <div>Kaynak<br /><b>{SOURCE_LABEL[b.source]}</b></div>
        <div>Başlangıç<br /><b>{trDate(b.startDate)}</b></div>
        <div>Bitiş<br /><b>{trDate(b.endDate)}</b></div>
        <div>Durum<br /><b style={{ color: b.status === "needs_review" ? "#fca5a5" : "#86efac" }}>{b.status === "needs_review" ? "⚠ Kontrol gerekli" : "Aktif"}</b></div>
      </div>
      <div className="calendar-sheet-notes">
        <p>{b.status === "needs_review"
          ? `Bu tarih aralığı ${SOURCE_LABEL[b.source]} üzerinden yönetiliyor olabilir ve sistemdeki bir kayıtla çakışıyor - kontrol edin.`
          : `Bu tarih aralığı ${SOURCE_LABEL[b.source]} üzerinden yönetiliyor; sistem içinde ayrı bir rezervasyon kaydı yok.`}</p>
      </div>
      {b.status === "needs_review" ? <SeasonBreakdown startDate={b.startDate} endDateExclusive={b.endDate} /> : null}
    </div>
  </div>;
}

// KESİN YILLIK SEZON KURALI - uzun bir OTA bloğu hem açık hem kapalı sezonu kapsayabilir; yalnız
// açık-sezonla kesişen kısım GERÇEK bir çakışma adayıdır, kapalı-sezon kısmı zaten kiralanmayacağı
// için "beklenen"dir - needs_review durumunun TAMAMINI aynı önemde göstermek yanıltıcı olur. Bu
// yalnız BİLGİLENDİRME amaçlı bir ayrıştırma - block'un kendi status/tarihlerini DEĞİŞTİRMEZ,
// takvim ızgarasının tasarımına dokunmaz (yalnız bu detay panelinde ek bir satır).
function SeasonBreakdown({ startDate, endDateExclusive }: { startDate: string; endDateExclusive: string }) {
  const { openSegments, closedSegments } = evaluateOtaBlockAgainstSeason(startDate, endDateExclusive);
  if (openSegments.length === 0 && closedSegments.length === 0) return null;
  return (
    <div className="calendar-sheet-notes">
      <small>SEZON KIRILIMI</small>
      {openSegments.length > 0 ? (
        <p style={{ color: "#fca5a5" }}>
          ÇAKIŞMA (gerçek açık sezon, 15 Haziran – 15 Eylül ile kesişiyor): {openSegments.map((s) => `${trDate(s.startDate)} – ${trDate(s.endDate)}`).join(", ")}
        </p>
      ) : null}
      {closedSegments.length > 0 ? (
        <p style={{ color: "#9fb0c5" }}>
          BEKLENEN KAPALI (kapalı sezon, çakışma sayılmaz): {closedSegments.map((s) => `${trDate(s.startDate)} – ${trDate(s.endDate)}`).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function VillaMonth({ villa, reservations, externalBlocks, year, month, onSelect }: { villa: Villa; reservations: Reservation[]; externalBlocks: AdminExternalBlock[]; year: number; month: number; onSelect: (selection: Selection) => void }) {
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const today = todayIstanbul();
  const villaRows = reservations.filter((item) => item.villa === villa);
  const villaBlocks = externalBlocks.filter((item) => item.villa === villa);

  return <section className={`villa-month villa-${villa.toLowerCase()}`}>
    <div className="villa-month-title"><div className="villa-calendar-mark">{villa[0]}</div><div><strong>Villa {villa}</strong><span>{villaRows.filter((r) => r.checkIn.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`).length} giriş</span></div></div>
    <div className="villa-calendar-grid">
      {weekdays.map((day) => <b className="villa-weekday" key={day}>{day}</b>)}
      {Array.from({ length: offset }, (_, index) => <span className="villa-empty-day" key={`empty-${index}`} />)}
      {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
        const date = isoDate(year, month, day);
        const arrival = villaRows.find((r) => r.checkIn === date);
        const departure = villaRows.find((r) => r.checkOut === date);
        const stay = !arrival && !departure ? villaRows.find((r) => r.checkIn < date && r.checkOut > date) : undefined;
        const block = villaBlocks.find((b) => b.startDate <= date && b.endDate > date);
        // Bir dış kaynak kaydı haftalar/aylar sürebilir (gerçek OTA senkron aralığı) - needs_review'i
        // o aralığın HER gününde tekrar tekrar göstermek "aynı kaydı" onlarca kez uyarı gibi göstermek
        // olur ve gerçekten dikkat gerektiren kaydı gürültüye gömer. Bir kayıt yalnız kendi
        // BAŞLANGIÇ gününde işaretlenir - business verisi (status) değişmiyor, yalnız TEKRARLANAN
        // görüntüleme kaldırılıyor.
        const isBlockStart = block ? block.startDate === date : false;
        const needsReview = block?.status === "needs_review" && isBlockStart;
        const turnover = Boolean(arrival && departure);
        const occupied = Boolean(arrival || departure || stay || block);

        const cellClass = `villa-day ${date === today ? "today" : ""} ${occupied ? "occupied" : ""} ${turnover ? "turnover" : ""}`;

        if (turnover) {
          return <article className={cellClass} key={date}>
            <strong>{day}</strong>
            <div className="day-turnover">
              <button type="button" className="day-half day-half-out" onClick={() => onSelect({ kind: "reservation", reservation: departure! })} aria-label={`Çıkış: ${departure!.guestName}`}>← Çıkış</button>
              <button type="button" className="day-half day-half-in" onClick={() => onSelect({ kind: "reservation", reservation: arrival! })} aria-label={`Giriş: ${arrival!.guestName}`}>→ Giriş</button>
            </div>
            {needsReview ? <button type="button" className="day-review-flag" onClick={() => onSelect({ kind: "block", block: block!, villa })} aria-label="Kontrol gerekli">⚠</button> : null}
          </article>;
        }

        const reservationEvent = arrival ?? departure ?? stay;
        const primary: Selection | null = reservationEvent
          ? { kind: "reservation", reservation: reservationEvent }
          : block
            ? { kind: "block", block, villa }
            : null;
        // needsReview bir dış kaynak bloğuna ait olabilir - o gün AYRICA bir rezervasyon da varsa
        // (primary = rezervasyon olur) uyarı rozeti yine de ayrı, kendi tıklamasıyla blok detayını
        // açan bağımsız bir eleman olarak gösterilmeli - aksi halde çakışma sessizce kaybolur. Blok
        // TEK BAŞINA (rezervasyon yokken) primary olduğunda ise ⚠ zaten hücrenin ana etiketinde
        // ("⚠ Kontrol") görünüyor - ayrı bir rozet TEKRAR göstermek gürültü/abartı olur.
        const warnIsSeparate = needsReview && primary?.kind !== "block";

        const role = arrival ? "arrival" : departure ? "departure" : stay ? "stay" : block ? "block" : "";
        const bandClass = role ? `band-${arrival ? "in" : departure ? "out" : stay ? "stay" : needsReview ? "warn" : "block"}` : "";
        const label = arrival ? "→ Giriş" : departure ? "← Çıkış" : stay ? "Dolu" : block ? (needsReview ? "⚠ Kontrol" : "Dolu") : "";

        return <article
          className={`${cellClass} ${bandClass} ${role ? `day-role-${role}` : ""}`}
          key={date}
          onClick={primary ? () => onSelect(primary) : undefined}
          role={primary ? "button" : undefined}
          tabIndex={primary ? 0 : undefined}
          onKeyDown={primary ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(primary); } } : undefined}
        >
          <strong>{day}</strong>
          {label ? <span className="day-label">{label}</span> : null}
          {warnIsSeparate ? <span
            className="day-review-flag"
            role="button"
            tabIndex={0}
            aria-label="Kontrol gerekli"
            onClick={(event) => { event.stopPropagation(); onSelect({ kind: "block", block: block!, villa }); }}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.stopPropagation(); event.preventDefault(); onSelect({ kind: "block", block: block!, villa }); } }}
          >⚠</span> : null}
        </article>;
      })}
    </div>
  </section>;
}

export default function VillaCalendarWorkspace({ reservations, locations, externalBlocks }: { reservations: Reservation[]; locations: VillaLocations; externalBlocks: AdminExternalBlock[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selection, setSelection] = useState<Selection | null>(null);
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
      <div><span className="ops-eyebrow">AYRI VİLLA TAKVİMLERİ</span><h1>Takvim ve günlük işlemler</h1><p>Safira ve Destan birbirinden ayrıdır; doluluk, giriş ve çıkışlar aynı ay içinde karşılaştırılır ama karışmaz. Bir güne tıklayarak detayları görün.</p></div>
      <div className="calendar-month-nav"><button onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button><strong>{monthTitle}</strong><button onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button></div>
    </header>

    <div className="calendar-legend">
      <span><i className="legend-dot legend-in" />Giriş</span>
      <span><i className="legend-dot legend-out" />Çıkış</span>
      <span><i className="legend-dot legend-stay" />Konaklama</span>
      <span><i className="legend-dot legend-warn" />⚠ Kontrol gerekli</span>
    </div>

    <div className="villa-calendar-pair">{villas.map((villa) => <VillaMonth key={villa} villa={villa} reservations={reservations} externalBlocks={externalBlocks} year={year} month={month} onSelect={setSelection} />)}</div>

    <section className="calendar-operations">
      <div className="calendar-operations-head"><div><span className="ops-eyebrow">AYLIK İŞLEM LİSTESİ</span><h2>Giriş ve çıkış aksiyonları</h2></div><b>{events.length} işlem</b></div>
      {events.length === 0 ? <div className="ops-empty">Bu ay giriş veya çıkış işlemi yok.</div> : <div className="calendar-operation-list">{events.map((event) => {
        const item = event.reservation;
        const disabled = !normalizePhone(item.phone) || (event.type === "Giriş" && !locations[item.villa]);
        return <article key={`${item.id}-${event.type}`} className={`calendar-operation ${event.type === "Giriş" ? "arrival" : "departure"}`}>
          <div className="calendar-operation-date"><strong>{trDate(event.date)}</strong><span>{event.type}</span></div>
          <div className="calendar-operation-guest"><b>Villa {item.villa}</b><strong>{item.guestName}</strong><span>{item.phone || "WhatsApp numarası yok"}</span></div>
          <div className="calendar-operation-actions">{disabled ? <span className="operation-warning">{!item.phone ? "Numara eksik" : "Konum eksik"}</span> : <a href={whatsappUrl(item.phone, guestMessage(item, event.type, locations))} target="_blank" rel="noreferrer">WhatsApp&apos;ta aç</a>}</div>
        </article>;
      })}</div>}
    </section>

    {selection ? <DetailSheet selection={selection} locations={locations} onClose={() => setSelection(null)} /> : null}
  </div>;
}
