import { describe, expect, it } from "vitest";
import { hasClosedSeasonNight, isClosedSeasonDate, SEASON_2027_MINIMUM_NIGHTS, SEASON_2027_OPEN_END, SEASON_2027_OPEN_START } from "./season-policy";

describe("isClosedSeasonDate - kesin sezon politikasi sinir testleri (2026-09-02 karari)", () => {
  it("2026-09-30 = mevcut 2026 policy'ye gore son acik gun sinirinin ICINDE (bu modulun kapsami disi -> false)", () => {
    expect(isClosedSeasonDate("2026-09-30")).toBe(false);
  });
  it("2026-10-01 = CLOSED", () => {
    expect(isClosedSeasonDate("2026-10-01")).toBe(true);
  });
  it("2027-06-14 = CLOSED", () => {
    expect(isClosedSeasonDate("2027-06-14")).toBe(true);
  });
  it("2027-06-15 = OPEN", () => {
    expect(isClosedSeasonDate("2027-06-15")).toBe(false);
  });
  it("2027-09-15 = OPEN", () => {
    expect(isClosedSeasonDate("2027-09-15")).toBe(false);
  });
  it("2027-09-16 = CLOSED", () => {
    expect(isClosedSeasonDate("2027-09-16")).toBe(true);
  });
  it("2027 acik pencere disindaki uzak gelecek (2028+) de yeni bir sezon karari alinana kadar CLOSED sayilir (veri uydurmamak icin muhafazakar varsayilan)", () => {
    expect(isClosedSeasonDate("2028-06-20")).toBe(true);
  });
  it("acik pencere sabitleri kullanicinin kesinlestirdigi tarihlerle birebir eslesir", () => {
    expect(SEASON_2027_OPEN_START).toBe("2027-06-15");
    expect(SEASON_2027_OPEN_END).toBe("2027-09-15");
    expect(SEASON_2027_MINIMUM_NIGHTS).toBe(4);
  });
});

describe("hasClosedSeasonNight - kismen bile kapali sezona tasan araliklar", () => {
  it("tamamen acik sezon icindeki bir aralik icin false doner", () => {
    expect(hasClosedSeasonNight("2027-06-15", "2027-06-22")).toBe(false);
  });
  it("tamamen kapali sezon icindeki bir aralik icin true doner", () => {
    expect(hasClosedSeasonNight("2026-11-01", "2026-11-08")).toBe(true);
  });
  it("girisi acik, cikisi kapali sezona tasan bir aralik icin true doner (kismi kabul yok)", () => {
    expect(hasClosedSeasonNight("2027-09-12", "2027-09-18")).toBe(true);
  });
  it("girisi kapali, cikisi acik sezona giren bir aralik icin true doner", () => {
    expect(hasClosedSeasonNight("2027-06-10", "2027-06-18")).toBe(true);
  });
  it("gecersiz aralik (checkOut <= checkIn) icin false doner - ayri bir validasyon katmaninin isi", () => {
    expect(hasClosedSeasonNight("2027-06-20", "2027-06-15")).toBe(false);
  });
});
