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
});
