import { describe, expect, it } from "vitest";
import { computePriceCoverage, computePriceQuote, type PriceRangeInput } from "./price-engine";

const SINGLE_SEASON: PriceRangeInput[] = [
  { startDate: "2026-06-01", endDate: "2026-08-31", nightlyRate: 10000 },
];

const MULTI_SEASON: PriceRangeInput[] = [
  { startDate: "2026-06-01", endDate: "2026-06-14", nightlyRate: 8000 },
  { startDate: "2026-06-15", endDate: "2026-06-30", nightlyRate: 12000 },
];

describe("computePriceQuote", () => {
  it("tek sezon icinde dogru toplam/gece/ortalama hesaplar", () => {
    const result = computePriceQuote(SINGLE_SEASON, "2026-06-10", "2026-06-17");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen status");
    expect(result.nights).toBe(7);
    expect(result.total).toBe(70000);
    expect(result.averageRate).toBe(10000);
    expect(result.segments).toHaveLength(1);
  });

  it("iki sezona yayilan tarih araligini dogru segmentlere ayirir", () => {
    // 12-19 Haziran: 12-14 (3 gece @8000) + 15-19 (4 gece @12000)
    const result = computePriceQuote(MULTI_SEASON, "2026-06-12", "2026-06-19");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen status");
    expect(result.nights).toBe(7);
    expect(result.segments).toEqual([
      { startDate: "2026-06-12", endDate: "2026-06-15", nights: 3, nightlyRate: 8000, subtotal: 24000 },
      { startDate: "2026-06-15", endDate: "2026-06-19", nights: 4, nightlyRate: 12000, subtotal: 48000 },
    ]);
    expect(result.total).toBe(24000 + 48000);
    expect(result.averageRate).toBeCloseTo((24000 + 48000) / 7);
  });

  it("checkout gunu fiyata dahil edilmez (exclusive-end)", () => {
    // 3 gece: 01,02,03 - checkout (04) fiyatlanmamali
    const ranges: PriceRangeInput[] = [{ startDate: "2026-06-01", endDate: "2026-06-03", nightlyRate: 5000 }];
    const result = computePriceQuote(ranges, "2026-06-01", "2026-06-04");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen status");
    expect(result.nights).toBe(3);
    expect(result.total).toBe(15000);
  });

  it("herhangi bir gecede fiyat tanimli degilse 'gap' doner - KISMI/TAHMINI toplam UYDURMAZ", () => {
    // price_ranges yalniz 06-01..06-14 kapsiyor, 06-20..06-22 sorgulaniyor - tam gap
    const result = computePriceQuote(SINGLE_SEASON.map((r) => ({ ...r, endDate: "2026-06-14" })), "2026-06-20", "2026-06-22");
    expect(result.status).toBe("gap");
    if (result.status !== "gap") throw new Error("beklenmeyen status");
    expect(result.missingDates).toEqual(["2026-06-20", "2026-06-21"]);
  });

  it("aralik kismen kapliysa (bir gece bile eksikse) yine 'gap' doner, toplami yariya dusurmez", () => {
    const ranges: PriceRangeInput[] = [{ startDate: "2026-06-01", endDate: "2026-06-05", nightlyRate: 5000 }];
    // 06-01..06-08: 01-04 kapli, 05-07 kapsiz (endDate 06-05 dahil oldugu icin 05 kapli, 06-07 kapsiz)
    const result = computePriceQuote(ranges, "2026-06-01", "2026-06-08");
    expect(result.status).toBe("gap");
    if (result.status !== "gap") throw new Error("beklenmeyen status");
    expect(result.missingDates.length).toBeGreaterThan(0);
    expect(result.missingDates).not.toContain("2026-06-01"); // kapli gunler listede olmamali
  });

  it("checkOut <= checkIn icin 'invalid_range' doner, hicbir fiyat hesaplamaz", () => {
    expect(computePriceQuote(SINGLE_SEASON, "2026-06-10", "2026-06-10")).toEqual({ status: "invalid_range" });
    expect(computePriceQuote(SINGLE_SEASON, "2026-06-10", "2026-06-05")).toEqual({ status: "invalid_range" });
  });

  it("bos checkIn/checkOut icin 'invalid_range' doner", () => {
    expect(computePriceQuote(SINGLE_SEASON, "", "2026-06-05")).toEqual({ status: "invalid_range" });
  });

  it("gercek production Destan fiyat kayitlariyla (2026-09-03 audit) dogru hesaplar", () => {
    // Gercek D1 verisi: 2026-06-20 -> 2026-09-13 @ 14142, 2026-09-14 -> 2026-09-30 @ 9285
    const ranges: PriceRangeInput[] = [
      { startDate: "2026-06-20", endDate: "2026-09-13", nightlyRate: 14142 },
      { startDate: "2026-09-14", endDate: "2026-09-30", nightlyRate: 9285 },
    ];
    // 10-17 Eylul: 10-13 sezon1 (4 gece), 14-17 sezon2 (3 gece)
    const result = computePriceQuote(ranges, "2026-09-10", "2026-09-17");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen status");
    expect(result.nights).toBe(7);
    expect(result.total).toBe(4 * 14142 + 3 * 9285);
  });

  it("2027 tarihleri icin (production'da hic fiyat yok) 'gap' doner", () => {
    const ranges: PriceRangeInput[] = [{ startDate: "2026-06-20", endDate: "2026-09-13", nightlyRate: 14142 }];
    const result = computePriceQuote(ranges, "2027-06-01", "2027-06-08");
    expect(result.status).toBe("gap");
  });
});

describe("computePriceCoverage", () => {
  it("tam kapsanan pencerede gapDays=0 doner", () => {
    const ranges: PriceRangeInput[] = [{ startDate: "2026-01-01", endDate: "2026-12-31", nightlyRate: 5000 }];
    const report = computePriceCoverage(ranges, "2026-06-01", 30);
    expect(report.gapDays).toBe(0);
    expect(report.coveredDays).toBe(30);
    expect(report.gapRanges).toEqual([]);
  });

  it("gercek production Safira kapsamiyla (2026-10-31 sonrasi bos) 330 gunluk gap'i dogru tespit eder", () => {
    const ranges: PriceRangeInput[] = [
      { startDate: "2026-04-01", endDate: "2026-05-22", nightlyRate: 5714 },
      { startDate: "2026-05-23", endDate: "2026-06-19", nightlyRate: 7142 },
      { startDate: "2026-06-20", endDate: "2026-09-13", nightlyRate: 10714 },
      { startDate: "2026-09-14", endDate: "2026-10-31", nightlyRate: 5714 },
    ];
    const report = computePriceCoverage(ranges, "2026-09-03", 330);
    expect(report.gapDays).toBeGreaterThan(0); // 2026-11-01'den itibaren tamamen bos
    expect(report.gapRanges.some((g) => g.startDate === "2026-11-01")).toBe(true);
  });

  it("ardisik gap gunlerini tek bir araliga birlestirir (satir satir degil)", () => {
    const ranges: PriceRangeInput[] = [{ startDate: "2026-06-10", endDate: "2026-06-20", nightlyRate: 5000 }];
    const report = computePriceCoverage(ranges, "2026-06-01", 30); // 06-01..06-30
    // 06-01..06-09 gap, 06-10..06-20 kapli, 06-21..06-30 gap -> 2 ayri gap araligi
    expect(report.gapRanges).toHaveLength(2);
  });
});
