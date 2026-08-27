import type { Reservation, Villa } from "./types";

export type AvailabilityClass =
  | "last-minute-gap"
  | "short-break"
  | "weekly"
  | "long-stay";

export type AvailabilityThresholds = {
  lastMinuteMax: number;
  shortBreakMax: number;
  weeklyMax: number;
};

export const DEFAULT_AVAILABILITY_THRESHOLDS: AvailabilityThresholds = {
  lastMinuteMax: 2,
  shortBreakMax: 6,
  weeklyMax: 13,
};

export type AvailabilityGap = {
  villa: Villa;
  startDate: string;
  endDate: string;
  nights: number;
  classification: AvailabilityClass;
  classificationLabel: string;
  isLastMinute: boolean;
  priority: "normal" | "high";
};

const DAY_MS = 86_400_000;

function dateMs(value: string) {
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  if (!Number.isFinite(timestamp)) throw new Error("Geçerli bir tarih gerekli.");
  return timestamp;
}

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number) {
  return isoDate(new Date(dateMs(value) + days * DAY_MS));
}

export function diffDays(start: string, end: string) {
  return Math.round((dateMs(end) - dateMs(start)) / DAY_MS);
}

export function classifyAvailability(
  nights: number,
  thresholds = DEFAULT_AVAILABILITY_THRESHOLDS,
) {
  if (nights <= thresholds.lastMinuteMax) {
    return { classification: "last-minute-gap", label: "Son dakika boşluğu" } as const;
  }
  if (nights <= thresholds.shortBreakMax) {
    return { classification: "short-break", label: "Kısa tatil fırsatı" } as const;
  }
  if (nights <= thresholds.weeklyMax) {
    return { classification: "weekly", label: "Haftalık müsaitlik" } as const;
  }
  return { classification: "long-stay", label: "Uzun dönem müsaitlik" } as const;
}

export function getVillaAvailabilityWindows(
  villa: Villa,
  from: string,
  to: string,
  reservations: Reservation[],
  options: {
    today?: string;
    minNights?: number;
    lastMinuteDays?: number;
    thresholds?: AvailabilityThresholds;
  } = {},
): AvailabilityGap[] {
  const today = options.today ?? isoDate(new Date());
  const start = from < today ? today : from;
  const minNights = Math.max(1, options.minNights ?? 1);
  const lastMinuteDays = Math.max(1, options.lastMinuteDays ?? 7);
  if (to <= start) return [];

  const bookings = reservations
    .filter(
      (reservation) =>
        reservation.villa === villa &&
        reservation.checkIn < to &&
        reservation.checkOut > start,
    )
    .map((reservation) => ({
      start: reservation.checkIn < start ? start : reservation.checkIn,
      end: reservation.checkOut > to ? to : reservation.checkOut,
    }))
    .sort((left, right) => left.start.localeCompare(right.start));

  const windows: AvailabilityGap[] = [];
  let cursor = start;

  function append(end: string) {
    const nights = diffDays(cursor, end);
    if (nights < minNights) return;
    const type = classifyAvailability(nights, options.thresholds);
    const daysUntilStart = diffDays(today, cursor);
    windows.push({
      villa,
      startDate: cursor,
      endDate: end,
      nights,
      classification: type.classification,
      classificationLabel: type.label,
      isLastMinute: daysUntilStart <= lastMinuteDays,
      priority: daysUntilStart <= 3 ? "high" : "normal",
    });
  }

  for (const booking of bookings) {
    if (booking.start > cursor) append(booking.start);
    if (booking.end > cursor) cursor = booking.end;
  }
  if (cursor < to) append(to);
  return windows;
}

export function findAvailabilityGaps(
  reservations: Reservation[],
  startDate: string,
  horizonDays = 90,
) {
  const endDate = addDays(startDate, horizonDays);
  return (["Safira", "Destan"] as const)
    .flatMap((villa) =>
      getVillaAvailabilityWindows(villa, startDate, endDate, reservations, {
        today: startDate,
      }),
    )
    .sort(
      (left, right) =>
        left.startDate.localeCompare(right.startDate) ||
        left.villa.localeCompare(right.villa),
    );
}

export function reservationOverlapsWindow(
  reservation: Pick<Reservation, "checkIn" | "checkOut">,
  startDate: string,
  endDate: string,
) {
  return reservation.checkIn < endDate && reservation.checkOut > startDate;
}

export function availabilityCampaignStillValid(
  reservations: Array<Pick<Reservation, "villa" | "checkIn" | "checkOut">>,
  villa: Villa,
  startDate: string,
  endDate: string,
) {
  return !reservations.some((reservation) =>
    reservation.villa === villa && reservationOverlapsWindow(reservation, startDate, endDate));
}
