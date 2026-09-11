import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { approvedSpecialDayMedia } from "./special-day-media";
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

  it("önceden seed edilmiş Cuma satırlarını hem UI hem cron yolunda nötrleştirir", () => {
    const helper = source("src/lib/social-friday-reconcile.ts");
    const route = source("src/app/api/social-posts/route.ts");
    const worker = source("custom-worker.mjs");
    expect(helper).toContain("scheduled_date >= '2026-09-11'");
    expect(helper).toContain("scheduled_date < '2026-10-11'");
    expect(helper).toContain("strftime('%w', scheduled_date) = '5'");
    expect(helper).toContain("media_url LIKE '%_special-day_%'");
    expect(route).toContain("await reconcileLegacyFridayPosts()");
    expect(worker).toContain("await reconcileLegacyFridayPosts(env, scheduledAt)");
  });

  it("public Cuma görseli marka footer'ına gitmeden nötr renderer ile üretilir", () => {
    const route = source("src/app/api/public/social-assets/[id]/[format]/route.tsx");
    expect(route).toContain('if (match?.kind === "friday")');
    expect(route).toContain("renderNeutralFriday(format, FRIDAY_VISUAL_MESSAGE)");
    expect(route).toContain("Cuma; huzurun, bereketin ve duaların buluştuğu mübarek bir gündür. Dualarınızın kabul olmasını dileriz.");

    const neutralStart = route.indexOf("function renderNeutralFriday");
    const neutralEnd = route.indexOf("// FAZ 5 bölüm 9", neutralStart);
    expect(neutralStart).toBeGreaterThan(-1);
    expect(neutralEnd).toBeGreaterThan(neutralStart);
    const neutralRenderer = route.slice(neutralStart, neutralEnd);
    expect(neutralRenderer).not.toContain("BrandFooter");
    expect(neutralRenderer).not.toContain("VILLA SAFIRA");
    expect(neutralRenderer).not.toContain("VILLA DESTAN");
    expect(neutralRenderer).toContain("Hayırlı Cumalar");
  });

  it("AUTO_SAFE Cuma görselini yalnız doğru villa/tarih/origin eşleşmesinde onaylar", () => {
    const origins = ["https://admin.safiradestan.com"];
    expect(approvedSpecialDayMedia(
      { villa: "Safira", scheduledDate: "2026-09-11" },
      "https://admin.safiradestan.com/api/public/social-assets/safira_special-day_2026-09-11/feed",
      origins,
    )).toEqual({ mediaKind: "image", format: "feed" });
    expect(approvedSpecialDayMedia(
      { villa: "Destan", scheduledDate: "2026-09-11" },
      "https://admin.safiradestan.com/api/public/social-assets/safira_special-day_2026-09-11/feed",
      origins,
    )).toBeNull();
    expect(approvedSpecialDayMedia(
      { villa: "Safira", scheduledDate: "2026-09-11" },
      "https://example.com/api/public/social-assets/safira_special-day_2026-09-11/feed",
      origins,
    )).toBeNull();
  });

  it("Instagram ve Facebook yayın kapıları doğrulanmış special-day renderer'ını kabul eder", () => {
    const instagram = source("src/app/api/meta/instagram/publish/route.ts");
    const facebook = source("src/app/api/meta/facebook/publish/route.ts");
    expect(instagram).toContain("approvedSpecialDayMedia");
    expect(facebook).toContain("approvedSpecialDayMedia");
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
    expect(approvedSpecialDayMedia(
      { villa: "Destan", scheduledDate: "2027-04-23" },
      "https://admin.safiradestan.com/api/public/social-assets/destan_special-day_2027-04-23/feed",
      ["https://admin.safiradestan.com"],
    )).toEqual({ mediaKind: "image", format: "feed" });
  });

  it("günlük sosyal planlayıcı özel günleri de üretir ve AUTO_SAFE kayıtları otomatik onaylar", () => {
    const route = source("src/app/api/social-posts/plan-30-day/route.ts");
    const planner = source("src/lib/social-plan-seed.ts");
    expect(route).toContain("ensureSpecialDayPosts");
    expect(route).toContain("await ensureSpecialDayPosts()");
    expect(planner).toContain("seedSocialPosts(inputs, { autoApproveNewRows: true })");
  });
});
