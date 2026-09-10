import { describe, expect, it } from "vitest";
import { REGION_GUIDE_PAGES, REGION_GUIDE_PAGE_SLUGS } from "./region-guide-pages";

describe("regional guide SEO quality", () => {
  it("keeps SEO titles concise and unique", () => {
    const titles = REGION_GUIDE_PAGE_SLUGS.map((slug) => REGION_GUIDE_PAGES[slug].seoTitle);
    expect(new Set(titles).size).toBe(titles.length);
    for (const title of titles) {
      expect(title.length).toBeGreaterThanOrEqual(25);
      expect(title.length).toBeLessThanOrEqual(60);
    }
  });

  it("keeps meta descriptions useful without snippet bloat", () => {
    for (const slug of REGION_GUIDE_PAGE_SLUGS) {
      const description = REGION_GUIDE_PAGES[slug].metaDescription;
      expect(description.length).toBeGreaterThanOrEqual(110);
      expect(description.length).toBeLessThanOrEqual(160);
    }
  });

  it("keeps every detailed guide substantial enough to avoid thin doorway pages", () => {
    for (const slug of REGION_GUIDE_PAGE_SLUGS) {
      const page = REGION_GUIDE_PAGES[slug];
      expect(page.sections.length).toBeGreaterThanOrEqual(5);
      expect(page.intro.length).toBeGreaterThanOrEqual(150);
    }
  });

  it("her sayfa gerçek, doğrulanmış bir verifiedDate (YYYY-MM-DD) taşır - sahte 'bugün güncellendi' iddiası değil", () => {
    for (const slug of REGION_GUIDE_PAGE_SLUGS) {
      expect(REGION_GUIDE_PAGES[slug].verifiedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("xanthos/saklikent/yerel-pazar rehberleri region-guide.ts'teki (2026-09-09'da eklenen) yeni içerik ailesini tamamlar", () => {
    const newSlugs: (typeof REGION_GUIDE_PAGE_SLUGS)[number][] = ["xanthos", "saklikent", "yerel-pazar"];
    for (const slug of newSlugs) {
      expect(REGION_GUIDE_PAGE_SLUGS).toContain(slug);
      expect(REGION_GUIDE_PAGES[slug].relatedPlaceIds.length).toBeGreaterThan(0);
    }
  });

  it("yerel-pazar rehberi hiçbir uydurma fiyat/saat iddiası taşımaz (yalnız kalıcı gerçek: haftanın günü + ürün türleri)", () => {
    const page = REGION_GUIDE_PAGES["yerel-pazar"];
    const fullText = [page.intro, ...page.sections.map((s) => s.body), ...page.faq.map((f) => f.answer)].join(" ");
    expect(fullText).not.toMatch(/₺|TL\b|\d{1,2}:\d{2}/);
  });
});
