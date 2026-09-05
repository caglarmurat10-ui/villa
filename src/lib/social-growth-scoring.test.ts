import { describe, expect, it } from "vitest";
import { computeAudienceFitScore, computeLocationScore, computeRelevanceScore, computeScores, computeSpamRiskScore } from "./social-growth-scoring";

describe("social-growth-scoring", () => {
  it("computeLocationScore hedef lokasyonla tam eşleşmede 100 döner", () => {
    expect(computeLocationScore("Kaş")).toBe(100);
    expect(computeLocationScore("Patara, Antalya")).toBe(100);
  });

  it("computeLocationScore bölgesel eşleşmede (Antalya) orta skor döner", () => {
    expect(computeLocationScore("Antalya")).toBe(55);
  });

  it("computeLocationScore alakasız konumda düşük skor döner", () => {
    expect(computeLocationScore("İstanbul")).toBe(15);
  });

  it("computeLocationScore konum bilgisi yoksa null döner (0 değil)", () => {
    expect(computeLocationScore(null)).toBeNull();
    expect(computeLocationScore("")).toBeNull();
  });

  it("computeAudienceFitScore kategoriye göre sabit bir değer döner", () => {
    expect(computeAudienceFitScore("travel_creator")).toBeGreaterThan(computeAudienceFitScore("local_business"));
  });

  it("computeSpamRiskScore şüpheli kullanıcı adında yüksek risk döner", () => {
    const risky = computeSpamRiskScore({ username: "travel_1234567", bioSummary: null, sourceUrl: null });
    const clean = computeSpamRiskScore({ username: "kas_gezgini", bioSummary: "Patara ve Kaş gezi rehberi", sourceUrl: "https://example.com" });
    expect(risky).toBeGreaterThan(clean);
  });

  it("computeRelevanceScore ilgili anahtar kelimeler içeren bio'ya bonus verir", () => {
    const withKeywords = computeRelevanceScore({ category: "travel_creator", bioSummary: "Patara gezi ve tatil rehberi", locationHint: "Kaş" });
    const withoutKeywords = computeRelevanceScore({ category: "travel_creator", bioSummary: "", locationHint: null });
    expect(withKeywords).toBeGreaterThanOrEqual(withoutKeywords);
  });

  it("computeScores followers/engagement metriği hiç kullanmaz, yalnız mevcut alanlardan üretir", () => {
    const scores = computeScores({ category: "travel_creator", username: "kas_gezgini", bioSummary: "Patara tatil rehberi", locationHint: "Kaş", sourceUrl: "https://example.com" });
    expect(scores.finalGrowthScore).toBeGreaterThan(0);
    expect(scores.finalGrowthScore).toBeLessThanOrEqual(100);
    expect(scores).not.toHaveProperty("followersCount");
    expect(scores).not.toHaveProperty("engagementScore");
  });

  it("computeScores konum bilgisi eksikken bile makul bir skor üretir (ağırlık yeniden dağıtılır)", () => {
    const scores = computeScores({ category: "travel_creator", username: "gezgin", bioSummary: "travel content", locationHint: null, sourceUrl: null });
    expect(scores.locationScore).toBeNull();
    expect(scores.finalGrowthScore).toBeGreaterThan(0);
  });

  it("computeScores yüksek spam riskini final skordan düşer", () => {
    const clean = computeScores({ category: "travel_creator", username: "kas_gezgini", bioSummary: "Patara gezi rehberi", locationHint: "Kaş", sourceUrl: "https://example.com" });
    const spammy = computeScores({ category: "travel_creator", username: "abc123456789", bioSummary: null, locationHint: "Kaş", sourceUrl: null });
    expect(spammy.finalGrowthScore).toBeLessThan(clean.finalGrowthScore);
  });
});
