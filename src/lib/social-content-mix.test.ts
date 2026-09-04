import { describe, expect, it } from "vitest";
import { computeContentMix } from "./social-content-mix";

describe("computeContentMix", () => {
  it("bos sablon listesinde tum kategoriler 0 doner, bolme hatasi olmaz", () => {
    const report = computeContentMix([]);
    expect(report.totalTemplates).toBe(0);
    expect(report.entries.every((e) => e.actualPercent === 0)).toBe(true);
    expect(report.dominantCategoryWarning).toBeNull();
  });

  it("gercek uretim icerik kutuphanesi dagilimini dogru hesaplar - Villa+Ozel birlesik Villa/Konaklama'ya sayilir", () => {
    // Gercek theme sayimlari: Villa 24, Özel 6 (ikisi de Villa/Konaklama), Bölge 14, Müsaitlik 8, Gezi 8 (toplam 60)
    const templates = [
      ...Array(24).fill({ theme: "Villa" }),
      ...Array(6).fill({ theme: "Özel" }),
      ...Array(14).fill({ theme: "Bölge" }),
      ...Array(8).fill({ theme: "Müsaitlik" }),
      ...Array(8).fill({ theme: "Gezi" }),
    ];
    const report = computeContentMix(templates);
    expect(report.totalTemplates).toBe(60);

    const villa = report.entries.find((e) => e.category === "Villa/Konaklama")!;
    expect(villa.count).toBe(30); // 24 Villa + 6 Özel
    expect(villa.actualPercent).toBe(50); // 30/60 = %50, organik büyüme hedefi %15 - ASIRI TEMSIL EDILMIS
    expect(villa.overrepresented).toBe(true);

    const region = report.entries.find((e) => e.category === "Destinasyon/Bölge")!;
    expect(region.actualPercent).toBeCloseTo(23.3, 1); // 14/60 ≈ %23.3, hedef %25'e yakin
    expect(region.overrepresented).toBe(false);

    const availability = report.entries.find((e) => e.category === "Müsaitlik/Kampanya")!;
    expect(availability.count).toBe(8);
  });

  it("tek kategori toplamin %40'indan fazlasiysa dominant-category uyarisi verir", () => {
    const templates = [...Array(50).fill({ theme: "Villa" }), ...Array(10).fill({ theme: "Bölge" })];
    const report = computeContentMix(templates);
    expect(report.dominantCategoryWarning).toContain("Villa/Konaklama");
    expect(report.dominantCategoryWarning).toContain("reklam");
  });

  it("2026-09-04 organik büyüme karması dengeliyse hiçbir kategori overrepresented olmaz", () => {
    const templates = [
      ...Array(25).fill({ theme: "Bölge" }),
      ...Array(20).fill({ theme: "Gezi" }),
      ...Array(15).fill({ theme: "Villa" }),
      ...Array(10).fill({ theme: "Tarih-Doğa" }),
      ...Array(15).fill({ theme: "Yerel İpucu" }),
      ...Array(10).fill({ theme: "Güven" }),
      ...Array(5).fill({ theme: "Müsaitlik" }),
    ];
    const report = computeContentMix(templates);
    expect(report.entries.every((e) => !e.overrepresented)).toBe(true);
    expect(report.dominantCategoryWarning).toBeNull();
  });

  it("bilinmeyen/karma-disi theme etiketleri (SPECIAL_DAY/LOCAL_EVENT gibi) SAYILMAZ - kaybolmaz ama kategori dagilimini bozmaz", () => {
    const report = computeContentMix([{ theme: "SPECIAL_DAY" }, { theme: "Villa" }]);
    expect(report.totalTemplates).toBe(2); // totalTemplates hala TUM sablonlari sayar
    const villa = report.entries.find((e) => e.category === "Villa/Konaklama")!;
    expect(villa.count).toBe(1); // yalniz gercekten eslenen 1 tanesi kategori sayimina girer
    const allCounts = report.entries.reduce((sum, e) => sum + e.count, 0);
    expect(allCounts).toBe(1); // SPECIAL_DAY hicbir kategoriye sayilmadi (kaybolmadi, sadece haric tutuldu)
  });
});
