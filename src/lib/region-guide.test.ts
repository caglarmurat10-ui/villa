import { describe, expect, it } from "vitest";
import { GUIDE_PLACES } from "./region-guide";

describe("GUIDE_PLACES — veri bütünlüğü", () => {
  it("her yerin benzersiz bir id'si, gerçek bir kategorisi ve boş olmayan açıklaması var", () => {
    const ids = GUIDE_PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const place of GUIDE_PLACES) {
      expect(["tarih", "deniz", "doga", "gezi"]).toContain(place.category);
      expect(place.description.length).toBeGreaterThan(10);
      expect(place.mapsQuery.length).toBeGreaterThan(0);
    }
  });

  // Bölüm 4 - "local food/local markets" içerik ailesi: 2026-09-09'da çok kaynaklı web
  // araştırmasıyla doğrulanan Kaş Cuma Pazarı (bkz. dosyadaki kaynak notu).
  it("Kaş Cuma Pazarı (yerel yemek/pazar içerik ailesi) doğrulanmış bir kayıt olarak mevcut", () => {
    const market = GUIDE_PLACES.find((p) => p.id === "kas-cuma-pazari");
    expect(market).toBeDefined();
    expect(market?.name).toContain("Pazar");
    // Fiyat/saat gibi değişken bir iddia YOK - yalnız sabit gerçek (haftanın günü + ürün türleri).
    expect(market?.description).not.toMatch(/₺|TL|saat|:\d{2}/);
  });
});
