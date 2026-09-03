import { describe, expect, it } from "vitest";
import { computePriceQuote, type PriceRangeInput } from "../price-engine";
import { computeGoogleVrQuote } from "./feed";

const RANGES: PriceRangeInput[] = [
  { startDate: "2026-06-01", endDate: "2026-06-14", nightlyRate: 8000 },
  { startDate: "2026-06-15", endDate: "2026-06-30", nightlyRate: 12000 },
];

describe("computeGoogleVrQuote", () => {
  it("musait olmayan tarih icin available:false, totalMinor:null - hicbir zaman bookable gorunmez", () => {
    const quote = computeGoogleVrQuote("SAFIRA", "2026-06-10", "2026-06-15", 2, { priceRanges: RANGES, isOccupied: true });
    expect(quote.available).toBe(false);
    expect(quote.totalMinor).toBeNull();
    expect(quote.nightlyBreakdown).toEqual([]);
  });

  it("fiyat tanimsiz (gap) tarih icin available:false doner - AVAILABLE_WITH_PRICE asla uretilmez", () => {
    const quote = computeGoogleVrQuote("SAFIRA", "2027-01-01", "2027-01-08", 2, { priceRanges: RANGES, isOccupied: false });
    expect(quote.available).toBe(false);
    expect(quote.totalMinor).toBeNull();
  });

  it("musait + fiyatli tarih icin dogru gunluk kirilim ve toplam (TL -> kurus donusumu) uretir", () => {
    const quote = computeGoogleVrQuote("SAFIRA", "2026-06-01", "2026-06-04", 2, { priceRanges: RANGES, isOccupied: false });
    expect(quote.available).toBe(true);
    expect(quote.nightlyBreakdown).toHaveLength(3);
    expect(quote.nightlyBreakdown.every((day) => day.rateMinor === 800000)).toBe(true); // 8000 TL -> 800000 kurus
    expect(quote.totalMinor).toBe(3 * 800000);
  });

  it("Google feed toplami ile public sitenin canonical price-engine toplami BIREBIR ayni kaynaktan gelir (tek kaynak garantisi)", () => {
    const checkIn = "2026-06-12";
    const checkOut = "2026-06-19";
    const quote = computeGoogleVrQuote("DESTAN", checkIn, checkOut, 4, { priceRanges: RANGES, isOccupied: false });
    const publicQuote = computePriceQuote(RANGES, checkIn, checkOut);
    expect(publicQuote.status).toBe("ok");
    if (publicQuote.status !== "ok") throw new Error("beklenmeyen");
    expect(quote.totalMinor).toBe(Math.round(publicQuote.total * 100)); // AYNI hesaplamadan turetildi, ayri bir formul degil
  });

  it("propertyId ve occupancy oldugu gibi geri doner, uydurulmaz", () => {
    const quote = computeGoogleVrQuote("DESTAN", "2026-06-01", "2026-06-03", 6, { priceRanges: RANGES, isOccupied: false });
    expect(quote.propertyId).toBe("DESTAN");
    expect(quote.occupancy).toBe(6);
    expect(quote.currency).toBe("TRY");
  });
});
