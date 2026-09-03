import { describe, expect, it } from "vitest";
import { buildGbpCtaUrl, buildGbpLocalPostPayload, selectFirstGbpPostCandidate } from "./posts";

describe("buildGbpLocalPostPayload - Google LocalPost REST şemasına (v4, 2026-09-03 doğrulandı) birebir uyum", () => {
  it("STANDARD post için summary/topicType/media dolu, event/callToAction yoksa eklenmez", () => {
    const payload = buildGbpLocalPostPayload({ topicType: "STANDARD", summary: "Test özet", mediaSourceUrl: "https://example.com/x.jpg" });
    expect(payload.topicType).toBe("STANDARD");
    expect(payload.summary).toBe("Test özet");
    expect(payload.media).toEqual([{ sourceUrl: "https://example.com/x.jpg" }]);
    expect(payload.callToAction).toBeUndefined();
    expect(payload.event).toBeUndefined();
  });

  it("callToAction yalnız hem actionType hem url doluysa eklenir", () => {
    const payload = buildGbpLocalPostPayload({
      topicType: "STANDARD", summary: "x", mediaSourceUrl: "https://example.com/x.jpg",
      ctaActionType: "LEARN_MORE", ctaUrl: "https://safiradestan.com/villa-safira",
    });
    expect(payload.callToAction).toEqual({ actionType: "LEARN_MORE", url: "https://safiradestan.com/villa-safira" });
  });

  it("EVENT tipi icin event.schedule Google'in Date formatina (year/month/day) donusturulur", () => {
    const payload = buildGbpLocalPostPayload({
      topicType: "EVENT", summary: "x", mediaSourceUrl: "https://example.com/x.jpg",
      event: { title: "Yamaç Paraşütü Festivali", schedule: { startDate: "2027-05-01", endDate: "2027-05-03" } },
    });
    expect(payload.event).toEqual({
      title: "Yamaç Paraşütü Festivali",
      schedule: { startDate: { year: 2027, month: 5, day: 1 }, endDate: { year: 2027, month: 5, day: 3 } },
    });
  });

  it("STANDARD tipinde event alani hicbir zaman eklenmez, event verilmis olsa bile", () => {
    const payload = buildGbpLocalPostPayload({
      topicType: "STANDARD", summary: "x", mediaSourceUrl: "https://example.com/x.jpg",
      event: { title: "x", schedule: { startDate: "2027-01-01", endDate: "2027-01-02" } },
    });
    expect(payload.event).toBeUndefined();
  });
});

describe("buildGbpCtaUrl - section 11 dogru villa + UTM", () => {
  it("Safira icin Safira'nin kendi rezervasyon sayfasina gider, PII yok, UTM parametreleri dogru", () => {
    const url = new URL(buildGbpCtaUrl("Safira", "test_campaign"));
    expect(url.pathname).toBe("/villa-safira");
    expect(url.searchParams.get("utm_source")).toBe("google");
    expect(url.searchParams.get("utm_medium")).toBe("organic_gbp");
    expect(url.searchParams.get("utm_campaign")).toBe("test_campaign");
  });

  it("Destan icin Destan'in kendi rezervasyon sayfasina gider - villa cross-post izolasyonu", () => {
    const url = new URL(buildGbpCtaUrl("Destan", "test_campaign"));
    expect(url.pathname).toBe("/villa-destan");
  });
});

describe("selectFirstGbpPostCandidate - section 17 ilk aday, HENÜZ yayınlanmaz", () => {
  it("Safira icin gercek gbpContentLibrary'den bir villa-tanitim kaydi doner", () => {
    const candidate = selectFirstGbpPostCandidate("Safira");
    expect(candidate).not.toBeNull();
    expect(candidate!.draft.villa).toBe("Safira");
    expect(candidate!.draft.category).toBe("villa-tanitim");
    expect(candidate!.input.topicType).toBe("STANDARD");
    expect(candidate!.input.summary).toBe(candidate!.draft.body);
  });

  it("Destan icin de ayri, kendi villasina ait bir aday doner - cross-post yok", () => {
    const safira = selectFirstGbpPostCandidate("Safira")!;
    const destan = selectFirstGbpPostCandidate("Destan")!;
    expect(destan.draft.villa).toBe("Destan");
    expect(destan.draft.title).not.toBe(safira.draft.title);
  });

  it("website CTA'si olan bir taslak icin ctaUrl UTM'li doldurulur", () => {
    const candidate = selectFirstGbpPostCandidate("Safira")!;
    expect(candidate.input.ctaActionType).toBe("LEARN_MORE");
    expect(candidate.input.ctaUrl).toContain("utm_source=google");
  });
});
