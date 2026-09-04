import { describe, expect, it } from "vitest";
import { getPublicVillaMetadata } from "./public-villa-seo";

const SLUGS = ["villa-safira", "villa-destan"] as const;

describe("public villa search metadata", () => {
  it("keeps titles concise, branded and official-site specific", () => {
    for (const slug of SLUGS) {
      const metadata = getPublicVillaMetadata(slug);
      const title = String(metadata.title ?? "");
      expect(title).toContain("Resmi Site");
      expect(title.length).toBeLessThanOrEqual(60);
    }
  });

  it("keeps descriptions within a useful search-snippet range", () => {
    for (const slug of SLUGS) {
      const metadata = getPublicVillaMetadata(slug);
      const description = metadata.description ?? "";
      expect(description.length).toBeGreaterThanOrEqual(120);
      expect(description.length).toBeLessThanOrEqual(160);
    }
  });
});
