import type { Reservation, Villa } from "./types";

export type AvailabilityGap = {
  villa: Villa;
  startDate: string;
  endDate: string;
  nights: number;
};

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

function diffDays(start: string, end: string) {
  return Math.round((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86400000);
}

export function findAvailabilityGaps(reservations: Reservation[], startDate: string, horizonDays = 120): AvailabilityGap[] {
  const endDate = addDays(startDate, horizonDays);
  const villas: Villa[] = ["Safira", "Destan"];
  const gaps: AvailabilityGap[] = [];

  for (const villa of villas) {
    const bookings = reservations
      .filter((r) => r.villa === villa && r.checkOut > startDate && r.checkIn < endDate)
      .map((r) => ({ start: r.checkIn < startDate ? startDate : r.checkIn, end: r.checkOut > endDate ? endDate : r.checkOut }))
      .sort((a, b) => a.start.localeCompare(b.start));

    let cursor = startDate;
    for (const booking of bookings) {
      if (booking.start > cursor) {
        const nights = diffDays(cursor, booking.start);
        if (nights >= 2) gaps.push({ villa, startDate: cursor, endDate: booking.start, nights });
      }
      if (booking.end > cursor) cursor = booking.end;
    }
    if (cursor < endDate) {
      const nights = diffDays(cursor, endDate);
      if (nights >= 2) gaps.push({ villa, startDate: cursor, endDate, nights });
    }
  }

  return gaps.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.villa.localeCompare(b.villa));
}
