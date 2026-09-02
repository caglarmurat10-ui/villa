import { describe, expect, it } from "vitest";
import { MAX_TRUSTED_BLOCK_DAYS, blockDurationDays, isAnomalousBlockDuration } from "./anomaly";

describe("blockDurationDays", () => {
  it("hesaplar normal bir hafta suresini dogru", () => {
    expect(blockDurationDays("2026-09-01", "2026-09-08")).toBe(7);
  });

  it("art yil sinirini (leap year) dogru hesaplar", () => {
    // 2028 art yil - 29 Subat var
    expect(blockDurationDays("2028-02-01", "2028-03-01")).toBe(29);
  });

  it("2026-09-02 canlı olayindaki gercek anomali suresini dogru hesaplar", () => {
    // Destan/airbnb needs_review satiri: 2026-08-31 -> 2027-09-03
    expect(blockDurationDays("2026-08-31", "2027-09-03")).toBe(368);
  });
});

describe("isAnomalousBlockDuration", () => {
  it("normal bir tatil rezervasyonunu (7 gece) anomali saymaz", () => {
    expect(isAnomalousBlockDuration("2026-09-01", "2026-09-08")).toBe(false);
  });

  it("esik degerin (120 gun) tam altini anomali saymaz", () => {
    expect(isAnomalousBlockDuration("2026-01-01", "2026-04-30")).toBe(false); // 119 gun
  });

  it("esik degerin uzerini anomali sayar", () => {
    expect(isAnomalousBlockDuration("2026-01-01", "2026-05-02")).toBe(true); // 121 gun
  });

  it("2026-09-02 canlı olayindaki iki gercek anomali bloğunu da yakalar", () => {
    // Destan/airbnb needs_review: 2026-08-31 -> 2027-09-03 (368 gun)
    expect(isAnomalousBlockDuration("2026-08-31", "2027-09-03")).toBe(true);
    // Safira/booking needs_review: 2026-09-02 -> 2027-09-02 (365 gun)
    expect(isAnomalousBlockDuration("2026-09-02", "2027-09-02")).toBe(true);
  });

  it("MAX_TRUSTED_BLOCK_DAYS makul bir tatil-villa esigidir (30-200 gun arasi)", () => {
    expect(MAX_TRUSTED_BLOCK_DAYS).toBeGreaterThan(30);
    expect(MAX_TRUSTED_BLOCK_DAYS).toBeLessThan(200);
  });
});
