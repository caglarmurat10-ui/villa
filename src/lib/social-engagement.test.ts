import { describe, expect, it } from "vitest";
import { ctaStyleForIndex, ctaStyleForTheme, ctaTemplates, pickCtaLine, storyInteractionTemplates } from "./social-engagement";

describe("social organic growth CTA rotation", () => {
  it("varsayılan rotasyonda satış/DM CTA'sı kullanmaz", () => {
    const styles = Array.from({ length: 24 }, (_, index) => ctaStyleForIndex(index));
    expect(styles).not.toContain("dm");
  });

  it("varsayılan rotasyonda aynı CTA stili art arda gelmez", () => {
    const styles = Array.from({ length: 24 }, (_, index) => ctaStyleForIndex(index));
    for (let index = 1; index < styles.length; index += 1) {
      expect(styles[index]).not.toBe(styles[index - 1]);
    }
  });

  it("organik büyüme CTA'ları müsaitlik/rezervasyon/DM baskısı içermez", () => {
    for (const style of ["soru", "kaydet", "paylas", "profil-incele"] as const) {
      for (const line of ctaTemplates[style]) {
        expect(line.toLocaleLowerCase("tr-TR")).not.toMatch(/müsait|rezervasyon|whatsapp|\bdm\b/);
      }
    }
  });

  it("rota ve yerel ipucu temaları kaydet/paylaş odaklı başlar ve hiçbir discovery teması DM üretmez", () => {
    expect(ctaStyleForTheme("Rota", 0)).toBe("kaydet");
    expect(ctaStyleForTheme("Yerel İpucu", 1)).toBe("paylas");
    for (const theme of ["Rota", "Yerel İpucu", "Bölge", "Gezi", "Tarih-Doğa"]) {
      const styles = Array.from({ length: 24 }, (_, seed) => ctaStyleForTheme(theme, seed));
      expect(styles).not.toContain("dm");
    }
  });

  it("CTA metin havuzu tekrar hissini azaltacak kadar geniştir", () => {
    expect(ctaTemplates.soru.length).toBeGreaterThanOrEqual(5);
    expect(ctaTemplates.kaydet.length).toBeGreaterThanOrEqual(4);
    expect(ctaTemplates.paylas.length).toBeGreaterThanOrEqual(4);
    expect(ctaTemplates["profil-incele"].length).toBeGreaterThanOrEqual(4);
  });

  it("Story etkileşim kütüphanesi poll/question/slider çeşitliliğini korur ve id'ler benzersizdir", () => {
    expect(storyInteractionTemplates.length).toBeGreaterThanOrEqual(10);
    expect(new Set(storyInteractionTemplates.map((item) => item.id)).size).toBe(storyInteractionTemplates.length);
    expect(new Set(storyInteractionTemplates.map((item) => item.kind))).toEqual(new Set(["poll", "question", "slider"]));
    expect(storyInteractionTemplates.every((item) => item.manualReady)).toBe(true);
  });

  it("DM CTA'sı explicit dönüşüm içeriği için ayrıca kullanılabilir kalır", () => {
    expect(ctaTemplates.dm.length).toBeGreaterThan(0);
    expect(pickCtaLine("dm", 0)).toBe(ctaTemplates.dm[0]);
  });
});
