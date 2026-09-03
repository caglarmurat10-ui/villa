import { describe, expect, it } from "vitest";
import { evaluateOtaConflictDisposition } from "./conflict-disposition";

describe("evaluateOtaConflictDisposition - FALSE POSITIVE OTA CONFLICT SEMANTICS FIX (2026-09-03 karari)", () => {
  it("exact reservation == OTA block -> EXPECTED_RESERVATION_MIRROR", () => {
    const result = evaluateOtaConflictDisposition(
      { startDate: "2026-09-07", endDateExclusive: "2026-09-11" },
      [{ checkIn: "2026-09-07", checkOut: "2026-09-11" }],
    );
    expect(result).toBe("EXPECTED_RESERVATION_MIRROR");
  });

  it("OTA block rezervasyon tarafindan tamamen contained -> EXPECTED_RESERVATION_MIRROR", () => {
    const result = evaluateOtaConflictDisposition(
      { startDate: "2026-09-01", endDateExclusive: "2026-09-05" },
      [{ checkIn: "2026-08-31", checkOut: "2026-09-05" }],
    );
    expect(result).toBe("EXPECTED_RESERVATION_MIRROR");
  });

  it("OTA acik-sezon kismi rezervasyon tarafindan kapsaniyor + geri kalani CLOSED_SEASON -> EXPECTED_RESERVATION_MIRROR", () => {
    // Gercek production senaryosu: Destan Airbnb 2026-09-14 -> 2027-06-15, acik sezon kismi
    // yalniz 09-14/09-15, legacy Destan reservation (PRE_POLICY_CONFIRMED_EXCEPTION) 09-14 -> 09-20
    // bu iki geceyi de kapsiyor - kalan 09-16 -> 06-14 zaten kapali sezon, hic kontrol edilmez.
    const result = evaluateOtaConflictDisposition(
      { startDate: "2026-09-14", endDateExclusive: "2027-06-15" },
      [{ checkIn: "2026-09-14", checkOut: "2026-09-20" }],
    );
    expect(result).toBe("EXPECTED_RESERVATION_MIRROR");
  });

  it("kismi/aciklanamayan ortusme -> REAL conflict (REVIEW_REQUIRED)", () => {
    // Rezervasyon yalniz bloğun ilk gecesini kapsiyor, kalan acik-sezon geceleri aciklanmiyor.
    const result = evaluateOtaConflictDisposition(
      { startDate: "2026-07-01", endDateExclusive: "2026-07-08" },
      [{ checkIn: "2026-07-01", checkOut: "2026-07-03" }],
    );
    expect(result).toBe("REVIEW_REQUIRED");
  });

  it("hic rezervasyon yok + acik-sezon OTA blogu -> REVIEW_REQUIRED", () => {
    const result = evaluateOtaConflictDisposition(
      { startDate: "2026-07-01", endDateExclusive: "2026-07-08" },
      [],
    );
    expect(result).toBe("REVIEW_REQUIRED");
  });

  it("yalniz kapali-sezon blogu -> beklenen kapali, conflict sayisi 0 (EXPECTED_RESERVATION_MIRROR, rezervasyon olmasa bile)", () => {
    const result = evaluateOtaConflictDisposition(
      { startDate: "2026-10-01", endDateExclusive: "2027-03-01" },
      [],
    );
    expect(result).toBe("EXPECTED_RESERVATION_MIRROR");
  });

  it("gercek production Destan 3 fixture - ucu de informational/conflict sayisi 0 (EXPECTED_RESERVATION_MIRROR)", () => {
    // Block 1: Airbnb 2026-09-01 -> 2026-09-05, reservation b7cc7214-... 2026-08-31 -> 2026-09-05
    expect(evaluateOtaConflictDisposition(
      { startDate: "2026-09-01", endDateExclusive: "2026-09-05" },
      [{ checkIn: "2026-08-31", checkOut: "2026-09-05" }],
    )).toBe("EXPECTED_RESERVATION_MIRROR");

    // Block 2: Airbnb 2026-09-07 -> 2026-09-11, reservation legacy-3c77e908... birebir ayni
    expect(evaluateOtaConflictDisposition(
      { startDate: "2026-09-07", endDateExclusive: "2026-09-11" },
      [{ checkIn: "2026-09-07", checkOut: "2026-09-11" }],
    )).toBe("EXPECTED_RESERVATION_MIRROR");

    // Block 3: Airbnb 2026-09-14 -> 2027-06-15, reservation legacy-948b67ab... (PRE_POLICY_CONFIRMED_EXCEPTION) 2026-09-14 -> 2026-09-20
    expect(evaluateOtaConflictDisposition(
      { startDate: "2026-09-14", endDateExclusive: "2027-06-15" },
      [{ checkIn: "2026-09-14", checkOut: "2026-09-20" }],
    )).toBe("EXPECTED_RESERVATION_MIRROR");
  });

  it("birden fazla rezervasyon bir araya gelerek bloğun tum acik-sezon gecelerini kapsayabilir (tek rezervasyon zorunlu degil)", () => {
    const result = evaluateOtaConflictDisposition(
      { startDate: "2026-07-01", endDateExclusive: "2026-07-08" },
      [{ checkIn: "2026-07-01", checkOut: "2026-07-04" }, { checkIn: "2026-07-04", checkOut: "2026-07-08" }],
    );
    expect(result).toBe("EXPECTED_RESERVATION_MIRROR");
  });

  it("gecersiz aralik (endDateExclusive <= startDate) -> EXPECTED_RESERVATION_MIRROR (kontrol edilecek gece yok)", () => {
    expect(evaluateOtaConflictDisposition({ startDate: "2026-07-10", endDateExclusive: "2026-07-01" }, [])).toBe("EXPECTED_RESERVATION_MIRROR");
  });
});
