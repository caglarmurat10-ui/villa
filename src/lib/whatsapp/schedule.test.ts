import { describe, expect, it } from "vitest";
import { computeCheckoutReminderScheduledAt, istanbulTodayIso } from "./schedule";

describe("computeCheckoutReminderScheduledAt", () => {
  it("round 4 talebindeki örneği birebir üretir: checkout 2026-09-20 -> 2026-09-19T08:00:00.000Z (11:00 Europe/Istanbul)", () => {
    expect(computeCheckoutReminderScheduledAt("2026-09-20")).toBe("2026-09-19T08:00:00.000Z");
  });

  it("ay sınırı: checkout ayın 1'i ise hatırlatma önceki ayın son günü olur", () => {
    expect(computeCheckoutReminderScheduledAt("2026-10-01")).toBe("2026-09-30T08:00:00.000Z");
  });

  it("yıl sınırı: checkout 1 Ocak ise hatırlatma bir önceki yılın 31 Aralık'ı olur", () => {
    expect(computeCheckoutReminderScheduledAt("2027-01-01")).toBe("2026-12-31T08:00:00.000Z");
  });

  it("şubat/artık yıl sınırı: checkout 2028-03-01 (artık yıl) -> 2028-02-29", () => {
    expect(computeCheckoutReminderScheduledAt("2028-03-01")).toBe("2028-02-29T08:00:00.000Z");
  });

  it("artık olmayan yılda checkout 2026-03-01 -> 2026-02-28", () => {
    expect(computeCheckoutReminderScheduledAt("2026-03-01")).toBe("2026-02-28T08:00:00.000Z");
  });

  it("her zaman 08:00:00.000Z döner (Türkiye DST uygulamıyor, sabit UTC+3 = 11:00 yerel)", () => {
    const isoValues = ["2026-01-15", "2026-06-15", "2026-12-15"].map((date) => computeCheckoutReminderScheduledAt(date));
    for (const iso of isoValues) {
      expect(iso.endsWith("T08:00:00.000Z")).toBe(true);
    }
  });

  it("geçersiz format için hata fırlatır", () => {
    expect(() => computeCheckoutReminderScheduledAt("20-09-2026")).toThrow();
    expect(() => computeCheckoutReminderScheduledAt("not-a-date")).toThrow();
    expect(() => computeCheckoutReminderScheduledAt("")).toThrow();
  });
});

describe("istanbulTodayIso", () => {
  it("YYYY-MM-DD formatında sabit bir tarih döner", () => {
    const result = istanbulTodayIso(new Date("2026-09-09T20:00:00.000Z"));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("UTC gece yarısına yakın saatlerde bile Europe/Istanbul takvim gününü doğru hesaplar (UTC+3 kaydırma)", () => {
    // 2026-09-09T22:00:00Z = 2026-09-10 01:00 Europe/Istanbul (yeni gün)
    expect(istanbulTodayIso(new Date("2026-09-09T22:00:00.000Z"))).toBe("2026-09-10");
  });
});
