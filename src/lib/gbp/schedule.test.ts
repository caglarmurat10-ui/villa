import { describe, expect, it } from "vitest";
import { draftToInput, pickNextCategory, resolveGbpMediaUrl } from "./schedule";
import { gbpContentLibrary } from "../google-business-content";

describe("pickNextCategory - hiç paylaşılmamış önce, sonra en eski paylaşılan", () => {
  it("hiç paylaşılmamış bir kategori varsa onu seçer", () => {
    const lastPosted = new Map([["a", "2026-09-01T00:00:00.000Z"], ["b", "2026-09-02T00:00:00.000Z"]]);
    expect(pickNextCategory(["a", "b", "c"], lastPosted)).toBe("c");
  });

  it("hepsi paylaşılmışsa en eski attempted_at'a sahip olanı seçer", () => {
    const lastPosted = new Map([
      ["a", "2026-09-03T00:00:00.000Z"],
      ["b", "2026-09-01T00:00:00.000Z"],
      ["c", "2026-09-02T00:00:00.000Z"],
    ]);
    expect(pickNextCategory(["a", "b", "c"], lastPosted)).toBe("b");
  });

  it("tüm 12 kategori tükenince başa döner (döngüsel rotasyon)", () => {
    const categories = Array.from(new Set(gbpContentLibrary.filter((d) => d.villa === "Safira").map((d) => d.category)));
    expect(categories.length).toBe(12);
    const allPosted = new Map(categories.map((c, i) => [c, `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`]));
    // En eski (ilk index, en küçük tarih) tekrar seçilmeli
    expect(pickNextCategory(categories, allPosted)).toBe(categories[0]);
  });
});

describe("resolveGbpMediaUrl - yalnız gerçek, kimliksiz erişilebilir görsel URL'leri üretir", () => {
  it("region-guide: ipucu, mevcut public social-assets şablon rotasına dönüşür", () => {
    const url = resolveGbpMediaUrl("https://admin.safiradestan.com", "Safira", "region-guide:patara");
    expect(url).toBe("https://admin.safiradestan.com/api/public/social-assets/safira_destination_patara/feed");
  });

  it("Destan için villa segmenti doğru dönüşür", () => {
    const url = resolveGbpMediaUrl("https://admin.safiradestan.com", "Destan", "region-guide:kas");
    expect(url).toBe("https://admin.safiradestan.com/api/public/social-assets/destan_destination_kas/feed");
  });

  it("doğrudan fotoğraf ipucu, o villanın gerçek Drive medyasından kararlı (deterministik) bir URL'e eşlenir", () => {
    const url1 = resolveGbpMediaUrl("https://admin.safiradestan.com", "Safira", "safira-havuz-genel-manzara.jpg");
    const url2 = resolveGbpMediaUrl("https://admin.safiradestan.com", "Safira", "safira-havuz-genel-manzara.jpg");
    expect(url1).toBe(url2);
    expect(url1).toMatch(/^https:\/\/admin\.safiradestan\.com\/api\/media\/drive\//);
  });

  it("başka bir villanın medya havuzundan görsel seçmez (cross-post yok)", () => {
    const url = resolveGbpMediaUrl("https://admin.safiradestan.com", "Destan", "destan-drone-genel-gorunum.jpg");
    expect(url).toMatch(/^https:\/\/admin\.safiradestan\.com\/api\/media\/drive\//);
  });
});

describe("draftToInput - website CTA'sı olan ve olmayan taslaklar doğru dönüşür", () => {
  it("cta:website olan taslak için LEARN_MORE + UTM'li url üretir", () => {
    const draft = gbpContentLibrary.find((d) => d.villa === "Safira" && d.category === "villa-tanitim")!;
    const input = draftToInput("Safira", draft, "https://example.com/x.jpg");
    expect(input.ctaActionType).toBe("LEARN_MORE");
    expect(input.ctaUrl).toContain("utm_medium=organic_gbp");
    expect(input.summary).toBe(draft.body);
    expect(input.mediaSourceUrl).toBe("https://example.com/x.jpg");
  });

  it("cta:null olan taslak için ctaActionType/ctaUrl tanımsız kalır", () => {
    const draft = gbpContentLibrary.find((d) => d.villa === "Safira" && d.category === "havuz-bahce")!;
    expect(draft.cta).toBeNull();
    const input = draftToInput("Safira", draft, "https://example.com/x.jpg");
    expect(input.ctaActionType).toBeUndefined();
    expect(input.ctaUrl).toBeUndefined();
  });

  it("cta:whatsapp olan taslak için de ctaActionType tanımsız kalır (GBP CTA tipi WhatsApp desteklemiyor, numara zaten metinde)", () => {
    const draft = gbpContentLibrary.find((d) => d.villa === "Safira" && d.category === "rezervasyon-iletisim")!;
    expect(draft.cta).toBe("whatsapp");
    const input = draftToInput("Safira", draft, "https://example.com/x.jpg");
    expect(input.ctaActionType).toBeUndefined();
  });
});
