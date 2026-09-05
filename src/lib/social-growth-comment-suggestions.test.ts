import { describe, expect, it } from "vitest";
import { generateCommentSuggestion } from "./social-growth-comment-suggestions";
import type { ProspectCategory } from "./social-growth-store";

const CATEGORIES: ProspectCategory[] = [
  "travel_creator", "local_creator", "tourism_page", "local_business",
  "photographer", "food_creator", "family_travel", "lifestyle_creator", "high_value_guest_source",
];

describe("social-growth-comment-suggestions", () => {
  it("her kategori ve şablon indeksi için her zaman REVIEW_REQUIRED döner", () => {
    for (const category of CATEGORIES) {
      for (let seedIndex = 0; seedIndex < 5; seedIndex += 1) {
        const result = generateCommentSuggestion({ category, locationHint: "Kaş", seedIndex });
        expect(result.riskClassification).toBe("REVIEW_REQUIRED");
      }
    }
  });

  it("hiçbir öneri link, fiyat, rezervasyon çağrısı veya agresif satış dili içermez", () => {
    for (const category of CATEGORIES) {
      for (let seedIndex = 0; seedIndex < 5; seedIndex += 1) {
        const { suggestedComment } = generateCommentSuggestion({ category, locationHint: "Patara", seedIndex });
        expect(suggestedComment).not.toMatch(/https?:\/\/|www\.|rezervasyon|fiyat|hemen (ara|yaz)/i);
        expect(suggestedComment.length).toBeLessThan(160);
      }
    }
  });

  it("lokasyon ipucu yoksa genel bir kelimeye düşer, kırılmaz", () => {
    const result = generateCommentSuggestion({ category: "travel_creator", locationHint: null, seedIndex: 0 });
    expect(result.suggestedComment.length).toBeGreaterThan(0);
    expect(result.suggestedComment).not.toContain("{location}");
  });

  it("lokasyon ipucu şablona doğal şekilde yerleşir", () => {
    const result = generateCommentSuggestion({ category: "travel_creator", locationHint: "Kaş", seedIndex: 0 });
    expect(result.suggestedComment).toContain("Kaş");
  });

  it("aynı seedIndex her zaman aynı öneriyi üretir (deterministik test edilebilirlik)", () => {
    const a = generateCommentSuggestion({ category: "photographer", locationHint: "Kalkan", seedIndex: 1 });
    const b = generateCommentSuggestion({ category: "photographer", locationHint: "Kalkan", seedIndex: 1 });
    expect(a.suggestedComment).toBe(b.suggestedComment);
  });
});
