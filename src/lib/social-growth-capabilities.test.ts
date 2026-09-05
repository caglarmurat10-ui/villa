import { describe, expect, it } from "vitest";
import { GROWTH_CAPABILITIES, growthCapabilitiesSummary } from "./social-growth-capabilities";

// Tripwire: bugünkü audit'e göre bu izinlerin HİÇBİRİ granted değil (src/lib/meta.ts yalnız
// instagram_business_basic,instagram_business_content_publish; src/lib/facebook.ts yalnız
// pages_show_list/pages_read_engagement/pages_manage_posts/pages_manage_metadata/instagram_basic
// istiyor). Biri gerçekten Meta App Review'dan geçip OAuth scope'una eklenmeden bu test kırılmadan
// available:true yapılmamalı.
describe("social-growth-capabilities", () => {
  it("bugün hiçbir Growth Agent özelliği mevcut izinlerle kullanılabilir değildir", () => {
    expect(GROWTH_CAPABILITIES.every((item) => item.available === false)).toBe(true);
  });

  it("her yetkinliğin gerekli izin açıklaması boş değildir", () => {
    expect(GROWTH_CAPABILITIES.every((item) => item.requiredPermission.length > 0)).toBe(true);
  });

  it("özet: 0 kullanılabilir, tamamı pending", () => {
    const summary = growthCapabilitiesSummary();
    expect(summary.available).toBe(0);
    expect(summary.pending).toBe(summary.total);
  });
});
