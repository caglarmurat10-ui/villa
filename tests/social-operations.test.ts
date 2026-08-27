import { describe, expect, it } from "vitest";
import { insightsPermissionStatus, parseInsightsMetrics } from "@/lib/instagramInsights";
import {
  availabilityCampaignStillValid,
  getVillaAvailabilityWindows,
  reservationOverlapsWindow,
} from "@/lib/social-availability";
import {
  contentScore,
  detectDuplicateContent,
  pilotLimitDecision,
  selectRotatingMedia,
} from "@/lib/social-rules";
import { createAvailabilityCaption, formatTurkishDateRange, TEMPLATE_COUNTS } from "@/lib/social-templates";
import { pilotEnabledDecision, pilotPrerequisiteDecision } from "@/lib/socialPilot";
import type { Reservation } from "@/lib/types";

const reservation = (checkIn: string, checkOut: string, villa: "Destan" | "Safira" = "Destan"): Reservation => ({
  id: `${villa}-${checkIn}`, villa, guestName: "Müşteri", phone: "", checkIn, checkOut,
  channel: "Doğrudan", nightlyRate: 1, totalAmount: 1, paidAmount: 0, notes: "",
  createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z",
});

describe("availability engine", () => {
  it("checkout gününü yeni check-in için müsait kabul eder ve boşlukları birleştirir", () => {
    const windows = getVillaAvailabilityWindows("Destan", "2026-08-27", "2026-09-10", [
      reservation("2026-08-29", "2026-09-01"), reservation("2026-09-04", "2026-09-06"),
    ], { today: "2026-08-27" });
    expect(windows.map((item) => [item.startDate, item.endDate, item.nights])).toEqual([
      ["2026-08-27", "2026-08-29", 2], ["2026-09-01", "2026-09-04", 3], ["2026-09-06", "2026-09-10", 4],
    ]);
  });
  it("geçmiş tarih üretmez ve diğer villanın rezervasyonundan etkilenmez", () => {
    const windows = getVillaAvailabilityWindows("Destan", "2026-08-01", "2026-08-30", [reservation("2026-08-27", "2026-08-29", "Safira")], { today: "2026-08-26" });
    expect(windows[0].startDate).toBe("2026-08-26");
  });
  it("overlap sınırlarını mevcut rezervasyon SQL mantığıyla aynı uygular", () => {
    expect(reservationOverlapsWindow(reservation("2026-09-01", "2026-09-05"), "2026-09-05", "2026-09-08")).toBe(false);
    expect(reservationOverlapsWindow(reservation("2026-09-04", "2026-09-06"), "2026-09-05", "2026-09-08")).toBe(true);
  });
  it("rezervasyon gelince planlı müsaitlik kampanyasını geçersiz sayar", () => {
    expect(availabilityCampaignStillValid([reservation("2026-09-04", "2026-09-06")], "Destan", "2026-09-05", "2026-09-10")).toBe(false);
  });
});

describe("caption ve duplicate kuralları", () => {
  const gap = { villa: "Destan" as const, startDate: "2026-08-27", endDate: "2026-09-01", nights: 5,
    classification: "short-break" as const, classificationLabel: "Kısa tatil fırsatı", isLastMinute: true, priority: "normal" as const };
  it("Türkçe tarih aralığını ISO göstermeden biçimler", () => {
    expect(formatTurkishDateRange("2026-08-27", "2026-08-31")).toBe("27–31 Ağustos");
    expect(formatTurkishDateRange("2026-08-27", "2026-09-01")).toBe("27 Ağustos – 1 Eylül");
  });
  it("istenen template bankalarını korur ve deterministik rotasyon yapar", () => {
    expect(TEMPLATE_COUNTS).toEqual({ Destan: 8, Safira: 8, lastMinute: 6, longStay: 6 });
    expect(createAvailabilityCaption(gap, { rotation: 0 })).toEqual(createAvailabilityCaption(gap, { rotation: 0 }));
    const variants = new Set(Array.from({ length: 8 }, (_, rotation) => createAvailabilityCaption(gap, { rotation }).templateId));
    expect(variants.size).toBeGreaterThan(1);
  });
  it("aynı availability window için duplicate oluşturmaz", () => {
    const recent = [{ villa: "Destan" as const, captionHash: "a", mediaIds: ["m1"], templateId: "t1",
      availabilityStart: "2026-09-01", availabilityEnd: "2026-09-05", publishedOrScheduledAt: "2026-08-26T00:00:00Z" }];
    expect(detectDuplicateContent({ villa: "Destan", captionHash: "b", mediaIds: ["m2"], templateId: "t2",
      availabilityStart: "2026-09-01", availabilityEnd: "2026-09-05" }, recent)).not.toBeNull();
  });
});

describe("pilot, medya ve skor", () => {
  it("pilot kapalıyken otomatik planlamayı kesin olarak durdurur", () => {
    expect(pilotEnabledDecision(false).shouldSchedule).toBe(false);
    expect(pilotPrerequisiteDecision({ enabled: false, hasAccount: true, hasAvailability: true, hasMedia: true, hasSlot: true })).toEqual({ allowed: false, reason: "disabled" });
  });
  it("pilot açık ve tüm önkoşullar hazırsa planlamaya izin verir", () => {
    expect(pilotPrerequisiteDecision({ enabled: true, hasAccount: true, hasAvailability: true, hasMedia: true, hasSlot: true })).toEqual({ allowed: true, reason: null });
  });
  it("günlük, haftalık ve 20 saat limitlerini uygular", () => {
    expect(pilotLimitDecision(["2026-08-26T08:30:00Z"], "2026-08-26T18:00:00Z", 3).reason).toBe("daily-limit");
    expect(pilotLimitDecision(["2026-08-24T08:30:00Z", "2026-08-25T08:30:00Z", "2026-08-26T08:30:00Z"], "2026-08-27T18:00:00Z", 3).reason).toBe("weekly-limit");
    expect(pilotLimitDecision(["2026-08-24T20:00:00Z"], "2026-08-25T10:00:00Z", 3).reason).toBe("minimum-spacing");
  });
  it("son üç medyayı dışlar, düşük kullanımı ve favoriyi değerlendirir", () => {
    const selected = selectRotatingMedia([
      { id: "recent", category: "Havuz", favorite: true, useCount: 0, lastUsedAt: null, active: true },
      { id: "normal", category: "Bahçe", favorite: false, useCount: 0, lastUsedAt: null, active: true },
      { id: "favorite", category: "Salon", favorite: true, useCount: 2, lastUsedAt: null, active: true },
    ], ["recent"], ["Havuz"]);
    expect(selected?.id).toBe("favorite");
  });
  it("eksik medya, CTA, duplicate ve dolu tarih için açıklamalı skor düşürür", () => {
    const result = contentScore({ caption: "Kısa metin", hasCta: false, hasMedia: false, dateValid: true,
      mediaRecentlyUsed: false, duplicate: true, availabilityValid: false });
    expect(result.score).toBeLessThan(50); expect(result.reasons.length).toBe(4);
  });
});

describe("insights parser", () => {
  it("yalnız Meta yanıtındaki gerçek sayısal metrikleri çıkarır", () => {
    expect(parseInsightsMetrics({ data: [{ name: "reach", total_value: { value: 42 } },
      { name: "views", values: [{ value: 20 }] }, { name: "missing", values: [] }] })).toEqual({ reach: 42, views: 20 });
  });
  it("eksik izin hatasını yeniden yetkilendirme fallbackine çevirir", () => {
    expect(insightsPermissionStatus(400, { error: { code: 10 } })).toBe("reauthorization_required");
    expect(insightsPermissionStatus(500, {})).toBe("error");
  });
});
