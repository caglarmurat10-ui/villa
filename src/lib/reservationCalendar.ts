import type { Reservation, Villa } from "./types";

export type CalendarMarkerKind = "check-in" | "stay" | "check-out";

export type ReservationCalendarMarker = {
  kind: CalendarMarkerKind;
  reservation: Reservation;
};

const markerOrder: Record<CalendarMarkerKind, number> = {
  "check-out": 0,
  "check-in": 1,
  stay: 2,
};

export function reservationsForVilla(reservations: Reservation[], villa: Villa) {
  return reservations.filter((reservation) => reservation.villa === villa);
}

export function reservationCalendarMarkers(
  reservations: Reservation[],
  villa: Villa,
  date: string,
): ReservationCalendarMarker[] {
  return reservationsForVilla(reservations, villa)
    .flatMap<ReservationCalendarMarker>((reservation) => {
      if (reservation.checkOut === date) return [{ kind: "check-out", reservation }];
      if (reservation.checkIn === date) return [{ kind: "check-in", reservation }];
      if (reservation.checkIn < date && date < reservation.checkOut) {
        return [{ kind: "stay", reservation }];
      }
      return [];
    })
    .sort((left, right) => markerOrder[left.kind] - markerOrder[right.kind]
      || left.reservation.guestName.localeCompare(right.reservation.guestName, "tr-TR"));
}
