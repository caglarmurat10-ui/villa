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

  it("OG görseli gerçek dosya piksel boyutlarını (2026-09-10'da JPEG header'ından doğrulandı) taşır - uydurma/varsayılan bir değer değil", () => {
    const firstImage = (images: unknown) => (Array.isArray(images) ? images[0] : images) as { width?: number; height?: number } | undefined;
    const safira = getPublicVillaMetadata("villa-safira");
    const destan = getPublicVillaMetadata("villa-destan");
    const safiraImage = firstImage(safira.openGraph?.images);
    const destanImage = firstImage(destan.openGraph?.images);
    expect(safiraImage?.width).toBe(1400);
    expect(safiraImage?.height).toBe(842);
    // İki villanın hero görseli AYNI boyutta değil - villaya göre farklı sabit kullanılmalı.
    expect(destanImage?.width).toBe(1400);
    expect(destanImage?.height).toBe(934);
  });
});
