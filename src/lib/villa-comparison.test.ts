import { describe, expect, it } from "vitest";
import { computeVillaComparisonRows } from "./villa-comparison";
import { VILLAS } from "./villa-content";

describe("computeVillaComparisonRows (ana sayfa villa karşılaştırma bölümü)", () => {
  it("her villa için VILLAS'taki gerçek quickFacts/adres alanlarını birebir yansıtır - uydurma sayı yok", () => {
    const rows = computeVillaComparisonRows(Object.values(VILLAS));
    expect(rows).toHaveLength(2);

    for (const row of rows) {
      const source = VILLAS[row.slug];
      const bySpecLabel = Object.fromEntries(row.specs.map((spec) => [spec.label, spec.value]));

      expect(row.name).toBe(source.name);
      expect(bySpecLabel["Kapasite"]).toBe(`${source.quickFacts.maxGuests} misafir`);
      expect(bySpecLabel["Yatak odası"]).toBe(`${source.quickFacts.bedroomCount} oda`);
      expect(bySpecLabel["Özel havuz"]).toBe(source.quickFacts.poolSize);
      expect(bySpecLabel["Konum"]).toBe(`${source.address.addressLocality} · ${source.address.addressRegion}`);
    }
  });

  it("Safira ve Destan'ın gerçek kapasitesi birbirinden farklıdır (5 vs 6 misafir) - karşılaştırma anlamlı", () => {
    const rows = computeVillaComparisonRows(Object.values(VILLAS));
    const safira = rows.find((r) => r.slug === "villa-safira")!;
    const destan = rows.find((r) => r.slug === "villa-destan")!;
    expect(safira.specs.find((s) => s.label === "Kapasite")?.value).toBe("5 misafir");
    expect(destan.specs.find((s) => s.label === "Kapasite")?.value).toBe("6 misafir");
  });
});
