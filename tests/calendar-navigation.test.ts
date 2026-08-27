import { describe, expect, it } from "vitest";
import { mainNavigationItems } from "@/lib/navigation";
import { reservationCalendarMarkers, reservationsForVilla } from "@/lib/reservationCalendar";
import type { Reservation, Villa } from "@/lib/types";

function reservation(id: string, villa: Villa, checkIn: string, checkOut: string): Reservation {
  return { id, villa, guestName: `Müşteri ${id}`, phone: "", checkIn, checkOut, channel: "Doğrudan", nightlyRate: 1000,
    totalAmount: 3000, paidAmount: 0, notes: "", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" };
}

describe("ana navigasyon", () => {
  it("Sosyal Medya, Ayarlar ve Hesaplamalar menülerini doğru hedeflerle gösterir", () => {
    expect(mainNavigationItems.find((item) => item.label === "Sosyal Medya")).toMatchObject({ kind: "link", href: "/sosyal" });
    expect(mainNavigationItems.some((item) => item.label === "Ayarlar")).toBe(true);
    expect(mainNavigationItems.some((item) => item.label === "Hesaplamalar")).toBe(true);
  });
});

describe("villa takvim markerları", () => {
  const data = [reservation("destan", "Destan", "2026-09-02", "2026-09-05"), reservation("safira", "Safira", "2026-09-03", "2026-09-06")];

  it("Destan ve Safira rezervasyonlarını yalnız kendi takvimine koyar", () => {
    expect(reservationsForVilla(data, "Destan").map((item) => item.id)).toEqual(["destan"]);
    expect(reservationCalendarMarkers(data, "Safira", "2026-09-03").map((item) => item.reservation.id)).toEqual(["safira"]);
  });

  it("giriş, ara konaklama ve çıkış gününü ayrı semantik markerlarla üretir", () => {
    expect(reservationCalendarMarkers(data, "Destan", "2026-09-02").map((item) => item.kind)).toEqual(["check-in"]);
    expect(reservationCalendarMarkers(data, "Destan", "2026-09-03").map((item) => item.kind)).toEqual(["stay"]);
    expect(reservationCalendarMarkers(data, "Destan", "2026-09-05").map((item) => item.kind)).toEqual(["check-out"]);
  });

  it("aynı gün checkout ve yeni checkin olayını birlikte korur", () => {
    const sameDay = [reservation("leaving", "Destan", "2026-09-01", "2026-09-05"), reservation("arriving", "Destan", "2026-09-05", "2026-09-08")];
    expect(reservationCalendarMarkers(sameDay, "Destan", "2026-09-05").map((item) => [item.kind, item.reservation.id])).toEqual([
      ["check-out", "leaving"], ["check-in", "arriving"],
    ]);
  });
});
