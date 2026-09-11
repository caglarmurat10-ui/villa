import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifySpecialDaySafety, getSpecialDayForDate } from "./special-days";

const root = fileURLToPath(new URL("../../", import.meta.url));

function source(relativePath: string) {
  return readFileSync(`${root}${relativePath}`, "utf8");
}

describe("sosyal medya Cuma mesajı", () => {
  it("Cuma caption'ı yalnız mesajdan oluşur; villa/Patara satırı eklenmez", () => {
    const planner = source("src/lib/social-plan-seed.ts");
    expect(planner).toContain('if (match.kind === "friday") return match.message;');
  });

  it("public Cuma görseli marka footer'ına gitmeden nötr renderer ile üretilir", () => {
    const route = source("src/app/api/public/social-assets/[id]/[format]/route.tsx");
    expect(route).toContain('if (match?.kind === "friday")');
    expect(route).toContain("renderNeutralFriday(format, match.message)");

    const neutralStart = route.indexOf("function renderNeutralFriday");
    const neutralEnd = route.indexOf("// FAZ 5 bölüm 9", neutralStart);
    expect(neutralStart).toBeGreaterThan(-1);
    expect(neutralEnd).toBeGreaterThan(neutralStart);
    const neutralRenderer = route.slice(neutralStart, neutralEnd);
    expect(neutralRenderer).not.toContain("BrandFooter");
    expect(neutralRenderer).not.toContain("VILLA SAFIRA");
    expect(neutralRenderer).not.toContain("VILLA DESTAN");
  });
});

describe("dini ve resmi gün otomasyonu", () => {
  it("doğrulanmış dini gün AUTO_SAFE sınıfındadır", () => {
    const match = getSpecialDayForDate("2026-12-10");
    expect(match?.kind).toBe("religious");
    expect(classifySpecialDaySafety(match!).automationClass).toBe("AUTO_SAFE");
  });

  it("sabit resmi gün AUTO_SAFE sınıfındadır", () => {
    const match = getSpecialDayForDate("2027-04-23");
    expect(match?.kind).toBe("fixed");
    expect(classifySpecialDaySafety(match!).automationClass).toBe("AUTO_SAFE");
  });

  it("günlük sosyal planlayıcı özel günleri de üretir ve AUTO_SAFE kayıtları otomatik onaylar", () => {
    const route = source("src/app/api/social-posts/plan-30-day/route.ts");
    const planner = source("src/lib/social-plan-seed.ts");
    expect(route).toContain("ensureSpecialDayPosts");
    expect(route).toContain("await ensureSpecialDayPosts()");
    expect(planner).toContain("seedSocialPosts(inputs, { autoApproveNewRows: true })");
  });
});
