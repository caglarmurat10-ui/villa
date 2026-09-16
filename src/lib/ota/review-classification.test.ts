import { describe, expect, it } from "vitest";
import {
  classifyOtaReviewBlock,
  countBlocksRequiringReview,
  requiresOperatorReview,
} from "./review-classification";
import type { ReservationRangeLike } from "./conflict-disposition";

// 2026-09-16 canlı D1 kayıtları. Bu blokların hiçbiri operatör aksiyonu gerektirmiyordu ama
// mobil dashboard ham needs_review sayımı yaptığı için "⚠ 5 OTA bloğu incelenmeyi bekliyor."
// yanlış pozitif uyarısı üretiliyordu. Bu test o regresyonun kilidi.
const CANLI_NEEDS_REVIEW = [
  { id: "6f9dc034", villa: "Safira", source: "airbnb", startDate: "2026-09-14", endDateExclusive: "2027-09-17" }, // 368 gün
  { id: "e46cc838", villa: "Destan", source: "airbnb", startDate: "2026-09-14", endDateExclusive: "2027-06-15" }, // 274 gün
  { id: "a5b464ec", villa: "Destan", source: "booking", startDate: "2026-09-20", endDateExclusive: "2027-06-15" }, // 268 gün
  { id: "e643598b", villa: "Destan", source: "booking", startDate: "2027-09-16", endDateExclusive: "2028-03-16" }, // 182 gün
  { id: "3d1e232d", villa: "Destan", source: "airbnb", startDate: "2027-09-16", endDateExclusive: "2027-09-17" }, // 1 gün, kapalı sezon
].map((b) => ({ ...b, status: "needs_review" as const }));

describe("368 günlük Safira anomalisi (geçmiş olay)", () => {
  it("karantina olarak sınıflanır, inceleme gerektirmez", () => {
    const block = { status: "needs_review", startDate: "2026-09-14", endDateExclusive: "2027-09-17" };
    expect(classifyOtaReviewBlock(block, [])).toBe("QUARANTINED_ANOMALY");
    expect(requiresOperatorReview(block, [])).toBe(false);
  });

  it("açık sezonda kapsanmayan geceler içerse bile uyarı üretmez", () => {
    // Rezervasyon yok - disposition tek başına REVIEW_REQUIRED derdi; süre anomalisi önce gelir.
    const block = { status: "needs_review", startDate: "2026-06-01", endDateExclusive: "2027-06-01" };
    expect(classifyOtaReviewBlock(block, [])).toBe("QUARANTINED_ANOMALY");
  });

  it("eşik tam 120 günde değil, 121 günde karantinaya alır (MAX_TRUSTED_BLOCK_DAYS regresyonu)", () => {
    const start = "2026-06-01";
    // 2026-06-01 -> 2026-09-29 tam 120 gün: güvenilen aralık, karantina DEĞİL.
    expect(classifyOtaReviewBlock({ status: "needs_review", startDate: start, endDateExclusive: "2026-09-29" }, [])).not.toBe("QUARANTINED_ANOMALY");
    // 2026-06-01 -> 2026-09-30 tam 121 gün: eşiği aşar, karantina.
    expect(classifyOtaReviewBlock({ status: "needs_review", startDate: start, endDateExclusive: "2026-09-30" }, [])).toBe("QUARANTINED_ANOMALY");
  });
});

describe("gerçek kısa süreli OTA bloğu", () => {
  it("açık sezonda rezervasyonsuz kısa blok inceleme gerektirir", () => {
    const block = { status: "needs_review", startDate: "2027-07-10", endDateExclusive: "2027-07-14" };
    expect(classifyOtaReviewBlock(block, [])).toBe("REVIEW_REQUIRED");
    expect(requiresOperatorReview(block, [])).toBe(true);
  });

  it("bilinen rezervasyonla tam kapsanan kısa blok yalnız bilgidir", () => {
    const reservations: ReservationRangeLike[] = [{ checkIn: "2027-07-10", checkOut: "2027-07-14" }];
    const block = { status: "needs_review", startDate: "2027-07-10", endDateExclusive: "2027-07-14" };
    expect(classifyOtaReviewBlock(block, reservations)).toBe("EXPECTED_RESERVATION_MIRROR");
    expect(requiresOperatorReview(block, reservations)).toBe(false);
  });

  it("kısmi kapsama hâlâ inceleme gerektirir", () => {
    const reservations: ReservationRangeLike[] = [{ checkIn: "2027-07-10", checkOut: "2027-07-12" }];
    const block = { status: "needs_review", startDate: "2027-07-10", endDateExclusive: "2027-07-14" };
    expect(classifyOtaReviewBlock(block, reservations)).toBe("REVIEW_REQUIRED");
  });

  it("yalnız kapalı sezon gecesi içeren blok inceleme gerektirmez", () => {
    const block = { status: "needs_review", startDate: "2027-09-16", endDateExclusive: "2027-09-17" };
    expect(classifyOtaReviewBlock(block, [])).toBe("EXPECTED_RESERVATION_MIRROR");
    expect(requiresOperatorReview(block, [])).toBe(false);
  });
});

describe("resolved/ignored kayıtlar", () => {
  it("active blok hiçbir zaman inceleme sayılmaz", () => {
    expect(requiresOperatorReview({ status: "active", startDate: "2027-07-10", endDateExclusive: "2027-07-14" }, [])).toBe(false);
  });

  it("needs_review dışındaki her statü uyarı üretmez", () => {
    for (const status of ["resolved", "ignored", "deleted", "active"]) {
      expect(requiresOperatorReview({ status, startDate: "2027-07-10", endDateExclusive: "2027-07-14" }, [])).toBe(false);
    }
  });
});

describe("dashboard uyarı görünürlüğü - canlı veri regresyonu", () => {
  it("2026-09-16 canlı needs_review kayıtlarının HİÇBİRİ uyarı üretmez", () => {
    for (const block of CANLI_NEEDS_REVIEW) {
      expect(requiresOperatorReview(block, [])).toBe(false);
    }
  });

  it("ham needs_review sayımı 5 iken aksiyon gerektiren sayım 0'dır", () => {
    expect(CANLI_NEEDS_REVIEW.length).toBe(5);
    const actionable = countBlocksRequiringReview(CANLI_NEEDS_REVIEW, new Map());
    expect(actionable).toBe(0);
  });

  it("gerçek bir kısa blok eklendiğinde uyarı yeniden görünür", () => {
    const withReal = [
      ...CANLI_NEEDS_REVIEW,
      { status: "needs_review", villa: "Safira", startDate: "2027-07-10", endDateExclusive: "2027-07-14" },
    ];
    expect(countBlocksRequiringReview(withReal, new Map())).toBe(1);
  });

  it("villa bazlı rezervasyonlar doğru eşleştirilir (çapraz villa sızıntısı yok)", () => {
    const blocks = [
      { status: "needs_review", villa: "Safira", startDate: "2027-07-10", endDateExclusive: "2027-07-14" },
      { status: "needs_review", villa: "Destan", startDate: "2027-07-10", endDateExclusive: "2027-07-14" },
    ];
    // Yalnız Safira'nın rezervasyonu var - Destan'ınki hâlâ inceleme gerektirmeli.
    const byVilla = new Map<string, ReservationRangeLike[]>([
      ["Safira", [{ checkIn: "2027-07-10", checkOut: "2027-07-14" }]],
    ]);
    expect(countBlocksRequiringReview(blocks, byVilla)).toBe(1);
  });
});
