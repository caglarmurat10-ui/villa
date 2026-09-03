import { describe, expect, it } from "vitest";
import { computePriceCoverage, computePriceQuote, splitEvenInstallments, splitEvenMinor, type PriceRangeInput } from "./price-engine";
import { isClosedSeasonDate } from "./season-policy";

// 2027-06-15 -> 2027-09-15 kullanıcı kararı (2026-09-03): Destan 130000 TRY / Safira 110000 TRY,
// 7 gecelik esas fiyat, minimum 4 gece. Gerçek production D1 kayıtlarıyla birebir aynı değerler.
const DESTAN_2027: PriceRangeInput = {
  startDate: "2027-06-15", endDate: "2027-09-15", nightlyRate: 18571.43,
  basePriceMinor: 13000000, baseNights: 7, minimumNights: 4,
};
const SAFIRA_2027: PriceRangeInput = {
  startDate: "2027-06-15", endDate: "2027-09-15", nightlyRate: 15714.29,
  basePriceMinor: 11000000, baseNights: 7, minimumNights: 4,
};

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

  it("isClosedSeasonDate VERILMEDIGINDE eski davranis birebir korunur (geriye donuk uyumluluk)", () => {
    const ranges: PriceRangeInput[] = [{ startDate: "2026-04-01", endDate: "2026-09-30", nightlyRate: 5714 }];
    const report = computePriceCoverage(ranges, "2026-09-03", 330);
    expect(report.closedSeasonDays).toBe(0);
    expect(report.closedSeasonRanges).toEqual([]);
    expect(report.gapDays).toBe(330 - report.coveredDays); // eski formul: gapDays = totalDays - coveredDays
  });

  it("KESIN SEZON POLITIKASI - gercek production kapsamiyla (2027 canonical + kapali sezon disi) closedSeasonDays PRICE_GAP'ten AYRI sayilir, yanlis '330 gunluk fiyat eksik' uretmez", () => {
    const ranges: PriceRangeInput[] = [
      { startDate: "2026-04-01", endDate: "2026-09-30", nightlyRate: 5714 }, // 2026 acik sezon (audit sonrasi gercek D1 durumu)
      { startDate: "2027-06-15", endDate: "2027-09-15", nightlyRate: 15714.29, basePriceMinor: 11000000, baseNights: 7, minimumNights: 4 }, // 2027 canonical
    ];
    const report = computePriceCoverage(ranges, "2026-09-03", 330, isClosedSeasonDate);
    // 2026-09-03..2026-09-30 kapli, 2026-10-01..2027-06-14 CLOSED_SEASON (gap DEGIL),
    // 2027-06-15 sonrasi (pencere sinirina kadar) kapli - pencere 2027-07-30'da bitiyor (330 gun).
    expect(report.gapDays).toBe(0);
    expect(report.closedSeasonDays).toBeGreaterThan(0);
    expect(report.closedSeasonRanges.some((r) => r.startDate === "2026-10-01")).toBe(true);
  });
});

describe("computePriceQuote - haftalık esas fiyat modeli (2027-06-15 -> 2027-09-15 kararı)", () => {
  it("Destan 7 gece (tam esas dönem) = TAM OLARAK 130000.00 TRY - 18571.43x7 yuvarlama sürüklenmesi YOK", () => {
    const result = computePriceQuote([DESTAN_2027], "2027-06-15", "2027-06-22");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen");
    expect(result.nights).toBe(7);
    expect(result.total).toBe(130000);
    expect(result.total).not.toBeCloseTo(18571.43 * 7, 5); // 18571.43*7=130000.01 - bu YANLIŞ olurdu
  });

  it("Safira 7 gece (tam esas dönem) = TAM OLARAK 110000.00 TRY", () => {
    const result = computePriceQuote([SAFIRA_2027], "2027-06-15", "2027-06-22");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen");
    expect(result.nights).toBe(7);
    expect(result.total).toBe(110000);
  });

  it("Destan 4 gece = minor-unit-safe oransal tutar: round(13000000*4/7)/100 = 74285.71", () => {
    const result = computePriceQuote([DESTAN_2027], "2027-06-15", "2027-06-19");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen");
    expect(result.nights).toBe(4);
    expect(result.total).toBe(74285.71);
  });

  it("Safira 4 gece = minor-unit-safe oransal tutar: round(11000000*4/7)/100 = 62857.14", () => {
    const result = computePriceQuote([SAFIRA_2027], "2027-06-15", "2027-06-19");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen");
    expect(result.nights).toBe(4);
    expect(result.total).toBe(62857.14);
  });

  it("Destan 14 gece (iki esas dönem denk) = TAM OLARAK 260000 TRY", () => {
    const result = computePriceQuote([DESTAN_2027], "2027-06-15", "2027-06-29");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen");
    expect(result.nights).toBe(14);
    expect(result.total).toBe(260000);
  });

  it("Safira 14 gece = TAM OLARAK 220000 TRY", () => {
    const result = computePriceQuote([SAFIRA_2027], "2027-06-15", "2027-06-29");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen");
    expect(result.nights).toBe(14);
    expect(result.total).toBe(220000);
  });

  it("3 gece (minimum 4'ün altında) - varsayılan enforceMinimumStay=true ile 'min_stay' döner, rezervasyon devam etmez", () => {
    const result = computePriceQuote([DESTAN_2027], "2027-06-15", "2027-06-18");
    expect(result.status).toBe("min_stay");
    if (result.status !== "min_stay") throw new Error("beklenmeyen");
    expect(result.minimumNights).toBe(4);
  });

  it("4 gece (minimum tam karşılanıyor) kabul edilir - 'ok' döner", () => {
    const result = computePriceQuote([DESTAN_2027], "2027-06-15", "2027-06-19");
    expect(result.status).toBe("ok");
  });

  it("enforceMinimumStay:false (admin/server path, db.ts getPriceQuote) ile 3 gece REDDEDİLMEZ - personel manuel istisna oluşturabilir", () => {
    const result = computePriceQuote([DESTAN_2027], "2027-06-15", "2027-06-18", { enforceMinimumStay: false });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen");
    expect(result.nights).toBe(3);
    // 3 gece icin de ayni minor-unit-safe oran: round(13000000*3/7)/100
    expect(result.total).toBe(Math.round((13000000 * 3) / 7) / 100);
  });

  it("public gösterimdeki referans gecelik fiyat (basePriceMinor/100/baseNights) doğru türetilir", () => {
    expect(DESTAN_2027.basePriceMinor! / 100 / DESTAN_2027.baseNights!).toBeCloseTo(18571.43, 2);
    expect(SAFIRA_2027.basePriceMinor! / 100 / SAFIRA_2027.baseNights!).toBeCloseTo(15714.29, 2);
  });

  it("legacy (haftalık esas fiyatsız) dönemler eski nights*nightlyRate davranışını birebir korur", () => {
    const legacy: PriceRangeInput = { startDate: "2026-06-01", endDate: "2026-06-30", nightlyRate: 10000 };
    const result = computePriceQuote([legacy], "2026-06-10", "2026-06-17");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen");
    expect(result.total).toBe(70000);
  });

  it("iki farklı dönem, TESADÜFEN aynı nightlyRate'e sahip olsa bile artık ayrı segment olarak kalır (range referansına göre gruplanır)", () => {
    const rangeA: PriceRangeInput = { startDate: "2026-07-01", endDate: "2026-07-10", nightlyRate: 9000 };
    const rangeB: PriceRangeInput = { startDate: "2026-07-11", endDate: "2026-07-20", nightlyRate: 9000 };
    const result = computePriceQuote([rangeA, rangeB], "2026-07-08", "2026-07-13");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("beklenmeyen");
    expect(result.segments).toHaveLength(2);
    expect(result.total).toBe(5 * 9000);
  });
});

describe("splitEvenMinor", () => {
  it("kuruş toplamı tam bölünmezse kalan ilk parçalara dağıtılır ve toplam korunur", () => {
    const parts = splitEvenMinor(13000000, 7);
    expect(parts).toEqual([1857143, 1857143, 1857143, 1857143, 1857143, 1857143, 1857142]);
    expect(parts.reduce((sum, n) => sum + n, 0)).toBe(13000000);
  });

  it("Google feed günlük kırılımı ile totalMinor arasında tek kuruşluk fark bile olmaz", () => {
    const segmentSubtotalMinor = Math.round((13000000 * 4) / 7); // 4 gecelik Destan payı, kuruş
    const perNight = splitEvenMinor(segmentSubtotalMinor, 4);
    expect(perNight.reduce((sum, n) => sum + n, 0)).toBe(segmentSubtotalMinor);
  });
});

describe("splitEvenInstallments", () => {
  it("tam bolunen tutarda hepsi esit doner", () => {
    expect(splitEvenInstallments(60000, 6)).toEqual([10000, 10000, 10000, 10000, 10000, 10000]);
  });

  it("bolunmeyen tutarda kalan ilk taksitlere +1 TL olarak dagitilir, toplam asla kaymaz", () => {
    const result = splitEvenInstallments(70001, 6);
    expect(result).toEqual([11667, 11667, 11667, 11667, 11667, 11666]);
    expect(result.reduce((sum, n) => sum + n, 0)).toBe(70001);
  });

  it("kesirli/float toplamlarda bile satir toplami girdiye esit kalir (float surklenmesi yok)", () => {
    for (const total of [1, 7, 99, 1000.4, 33333, 123456.6, 999999]) {
      const result = splitEvenInstallments(total, 6);
      const sum = result.reduce((acc, n) => acc + n, 0);
      expect(sum).toBe(Math.round(total));
      expect(result.every((n) => Number.isInteger(n))).toBe(true);
    }
  });

  it("installmentCount <= 0 icin bos dizi doner", () => {
    expect(splitEvenInstallments(1000, 0)).toEqual([]);
  });

  it("Destan 130000 TRY: 3 taksit toplamı == 6 taksit toplamı == peşin toplamı (müşteri toplamı değişmez)", () => {
    const cashTotal = 130000;
    expect(splitEvenInstallments(cashTotal, 3).reduce((sum, n) => sum + n, 0)).toBe(cashTotal);
    expect(splitEvenInstallments(cashTotal, 6).reduce((sum, n) => sum + n, 0)).toBe(cashTotal);
  });

  it("Safira 110000 TRY: 3 taksit toplamı == 6 taksit toplamı == peşin toplamı (müşteri toplamı değişmez)", () => {
    const cashTotal = 110000;
    expect(splitEvenInstallments(cashTotal, 3).reduce((sum, n) => sum + n, 0)).toBe(cashTotal);
    expect(splitEvenInstallments(cashTotal, 6).reduce((sum, n) => sum + n, 0)).toBe(cashTotal);
  });
});
