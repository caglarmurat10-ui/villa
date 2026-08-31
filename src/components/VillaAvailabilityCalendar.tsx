"use client";

import { useMemo, useState } from "react";
import type { Villa } from "@/lib/types";
import styles from "./VillaAvailabilityCalendar.module.css";

type BookingReservation = { villa: Villa; checkIn: string; checkOut: string };

const WEEKDAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTH_LABELS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function toISODate(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function isBooked(date: string, villa: Villa, reservations: BookingReservation[]) {
  return reservations.some((item) => item.villa === villa && date >= item.checkIn && date < item.checkOut);
}

function buildMonth(year: number, month: number) {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const mondayIndexedWeekday = (firstOfMonth.getUTCDay() + 6) % 7;
  const cells: Array<{ day: number; iso: string } | null> = [];
  for (let i = 0; i < mondayIndexedWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ day, iso: toISODate(year, month, day) });
  return cells;
}

export default function VillaAvailabilityCalendar({
  villa,
  reservations,
  checkIn,
  checkOut,
  onChange,
}: {
  villa: Villa;
  reservations: BookingReservation[];
  checkIn: string;
  checkOut: string;
  onChange: (next: { checkIn: string; checkOut: string }) => void;
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(now.getUTCMonth());
  const todayISO = now.toISOString().slice(0, 10);

  const months = useMemo(() => {
    const first = { year: viewYear, month: viewMonth, cells: buildMonth(viewYear, viewMonth) };
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    const second = { year: nextYear, month: nextMonth, cells: buildMonth(nextYear, nextMonth) };
    return [first, second];
  }, [viewYear, viewMonth]);

  function goPrev() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function goNext() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  function hasBookedBetween(from: string, to: string) {
    const cursor = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (cursor < end) {
      const iso = cursor.toISOString().slice(0, 10);
      if (isBooked(iso, villa, reservations)) return true;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return false;
  }

  function handleDayClick(iso: string) {
    if (!checkIn || (checkIn && checkOut)) {
      onChange({ checkIn: iso, checkOut: "" });
      return;
    }
    if (iso <= checkIn) {
      onChange({ checkIn: iso, checkOut: "" });
      return;
    }
    if (hasBookedBetween(checkIn, iso)) {
      onChange({ checkIn: iso, checkOut: "" });
      return;
    }
    onChange({ checkIn, checkOut: iso });
  }

  function dayState(iso: string) {
    const past = iso < todayISO;
    const booked = isBooked(iso, villa, reservations);
    const isCheckIn = iso === checkIn;
    const isCheckOut = iso === checkOut;
    const inRange = Boolean(checkIn && checkOut && iso > checkIn && iso < checkOut);
    return { past, booked, isCheckIn, isCheckOut, inRange, disabled: past || booked };
  }

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <button type="button" onClick={goPrev} aria-label="Önceki ay" className={styles.navBtn}>‹</button>
        <div className={styles.monthsLabel}>
          {months.map((m) => `${MONTH_LABELS[m.month]} ${m.year}`).join("  ·  ")}
        </div>
        <button type="button" onClick={goNext} aria-label="Sonraki ay" className={styles.navBtn}>›</button>
      </div>

      <div className={styles.months}>
        {months.map((m) => (
          <div className={styles.month} key={`${m.year}-${m.month}`}>
            <div className={styles.monthTitle}>{MONTH_LABELS[m.month]} {m.year}</div>
            <div className={styles.weekdays}>
              {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className={styles.grid}>
              {m.cells.map((cell, index) => {
                if (!cell) return <span key={`empty-${index}`} className={styles.empty} />;
                const state = dayState(cell.iso);
                const classNames = [
                  styles.day,
                  state.disabled ? styles.disabled : "",
                  state.isCheckIn || state.isCheckOut ? styles.selected : "",
                  state.inRange ? styles.inRange : "",
                ].filter(Boolean).join(" ");
                return (
                  <button
                    type="button"
                    key={cell.iso}
                    className={classNames}
                    disabled={state.disabled}
                    onClick={() => handleDayClick(cell.iso)}
                    aria-pressed={state.isCheckIn || state.isCheckOut}
                    aria-label={`${cell.day} ${MONTH_LABELS[m.month]}${state.booked ? " — dolu" : ""}`}
                    title={state.booked ? "Bu tarih dolu" : undefined}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.legend}>
        <span><i className={styles.legendAvailable} /> Müsait</span>
        <span><i className={styles.legendBooked} /> Dolu</span>
        <span><i className={styles.legendSelected} /> Seçili</span>
      </div>
    </div>
  );
}
