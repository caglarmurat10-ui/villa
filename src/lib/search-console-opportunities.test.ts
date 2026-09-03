import { describe, expect, it } from "vitest";
import { computeSearchConsoleOpportunities, type SearchConsoleQueryRow } from "./search-console-opportunities";

function row(query: string, impressions: number, ctr: number, position: number): SearchConsoleQueryRow {
  return { query, clicks: Math.round(impressions * ctr), impressions, ctr, position };
}

describe("computeSearchConsoleOpportunities", () => {
  it("az veri varken hasEnoughData=false doner, hicbir sey UYDURULMAZ", () => {
    const result = computeSearchConsoleOpportunities([row("patara villa", 10, 0.02, 8)], 0.05);
    expect(result.hasEnoughData).toBe(false);
    expect(result.opportunities).toEqual([]);
  });

  it("dusuk-etki (dusuk impression) satirlar sinyale dahil edilmez", () => {
    const rows = [row("a", 1, 0.01, 5), row("b", 2, 0.01, 6), row("c", 3, 0.01, 7)];
    const result = computeSearchConsoleOpportunities(rows, 0.05);
    expect(result.hasEnoughData).toBe(false); // MIN_IMPRESSIONS=5 altinda hicbiri sayilmiyor
  });

  it("yuksek gosterim + dusuk CTR sorgulari dogru tespit eder ve gosterime gore siralar", () => {
    const rows = [
      row("kas villa kiralama", 500, 0.005, 3), // CTR site ortalamasinin (0.05) yarisindan cok dusuk
      row("kalkan villa", 200, 0.006, 5),
      row("patara otel", 50, 0.06, 4), // CTR zaten iyi - firsat degil
      row("x", 10, 0.01, 2),
    ];
    const result = computeSearchConsoleOpportunities(rows, 0.05);
    expect(result.hasEnoughData).toBe(true);
    const lowCtr = result.opportunities.filter((o) => o.type === "high_impression_low_ctr");
    // "x" de esik altinda CTR'a sahip (0.01 &lt; 0.025) - uc satir da dahil, gosterime gore azalan sirali
    expect(lowCtr.map((o) => o.query)).toEqual(["kas villa kiralama", "kalkan villa", "x"]);
    expect(lowCtr.every((o) => o.ctr < 0.025)).toBe(true);
  });

  it("pozisyon 4-15 araligindaki sorgulari mid_position olarak isaretler, disindakileri hariç tutar", () => {
    const rows = [
      row("a", 50, 0.05, 2), // pozisyon 2 - zaten iyi, mid_position DEGIL
      row("b", 50, 0.05, 8), // mid_position
      row("c", 50, 0.05, 20), // cok derin - mid_position DEGIL
      row("d", 50, 0.05, 15), // sinir deger, dahil
      row("e", 50, 0.05, 4), // sinir deger, dahil
    ];
    const result = computeSearchConsoleOpportunities(rows, 0.05);
    const midPos = result.opportunities.filter((o) => o.type === "mid_position");
    expect(midPos.map((o) => o.query).sort()).toEqual(["b", "d", "e"]);
  });

  it("her oneri metninde gercek sorgu adi ve gercek sayilar geciyor - jenerik/uydurma metin yok", () => {
    const rows = [row("ozel havuzlu villa patara", 100, 0.01, 6), row("x", 80, 0.01, 7), row("y", 60, 0.01, 8)];
    const result = computeSearchConsoleOpportunities(rows, 0.05);
    const match = result.opportunities.find((o) => o.query === "ozel havuzlu villa patara");
    expect(match?.suggestion).toContain("ozel havuzlu villa patara");
    expect(match?.suggestion).toContain("100");
  });
});
