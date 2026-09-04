import { describe, expect, it } from "vitest";
import { ctaStyleForIndex, ctaTemplates, pickCtaLine } from "./social-engagement";

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

  it("DM CTA'sı explicit dönüşüm içeriği için ayrıca kullanılabilir kalır", () => {
    expect(ctaTemplates.dm.length).toBeGreaterThan(0);
    expect(pickCtaLine("dm", 0)).toBe(ctaTemplates.dm[0]);
  });
});
