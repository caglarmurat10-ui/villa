import { describe, expect, it } from "vitest";
import { computeContentMix } from "./social-content-mix";

describe("computeContentMix", () => {
  it("bos sablon listesinde tum kategoriler 0 doner, bolme hatasi olmaz", () => {
    const report = computeContentMix([]);
    expect(report.totalTemplates).toBe(0);
    expect(report.entries.every((e) => e.actualPercent === 0)).toBe(true);
    expect(report.dominantCategoryWarning).toBeNull();
  });

  it("gercek uretim icerik kutuphanesi dagilimini (2026-09-03 audit) dogru hesaplar", () => {
    // Gercek theme sayimlari: Villa 24, Bölge 14, Müsaitlik 8, Gezi 8, Özel 6 (toplam 60)
    const templates = [
      ...Array(24).fill({ theme: "Villa" }),
      ...Array(14).fill({ theme: "Bölge" }),
      ...Array(8).fill({ theme: "Müsaitlik" }),
      ...Array(8).fill({ theme: "Gezi" }),
      ...Array(6).fill({ theme: "Özel" }),
    ];
    const report = computeContentMix(templates);
    expect(report.totalTemplates).toBe(60);

    const villa = report.entries.find((e) => e.category === "Villa")!;
    expect(villa.count).toBe(24);
    expect(villa.actualPercent).toBe(40); // 24/60 = %40, hedef %20 - ASIRI TEMSIL EDILMIS
    expect(villa.overrepresented).toBe(true);

    const region = report.entries.find((e) => e.category === "Bölge")!;
    expect(region.actualPercent).toBeCloseTo(23.3, 1); // 14/60 ≈ %23.3, hedef %25'e yakin
    expect(region.overrepresented).toBe(false);
  });

  it("tek kategori toplamin %40'indan fazlasiysa dominant-category uyarisi verir", () => {
    const templates = [...Array(50).fill({ theme: "Villa" }), ...Array(10).fill({ theme: "Bölge" })];
    const report = computeContentMix(templates);
    expect(report.dominantCategoryWarning).toContain("Villa");
    expect(report.dominantCategoryWarning).toContain("reklam");
  });

  it("dengeli bir karma icin hicbir kategori overrepresented isaretlenmez", () => {
    const templates = [
      ...Array(25).fill({ theme: "Bölge" }),
      ...Array(20).fill({ theme: "Gezi" }),
      ...Array(20).fill({ theme: "Villa" }),
      ...Array(20).fill({ theme: "bilinmeyen-tema" }), // "Diğer" kovasina duser
      ...Array(15).fill({ theme: "Müsaitlik" }),
    ];
    const report = computeContentMix(templates);
    expect(report.entries.every((e) => !e.overrepresented)).toBe(true);
    expect(report.dominantCategoryWarning).toBeNull();
  });

  it("bilinmeyen theme etiketleri 'Diğer' kovasina duser, kaybolmaz", () => {
    const report = computeContentMix([{ theme: "Yeni Bir Tema" }, { theme: "Villa" }]);
    const other = report.entries.find((e) => e.category === "Diğer")!;
    expect(other.count).toBe(1);
    expect(report.totalTemplates).toBe(2);
  });
});
