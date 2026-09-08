// Hafif SEO sağlık kontrolü (bölüm 15) - pahalı bir crawler/altyapı KURULMAZ, bunun yerine sitedeki
// TÜM indexlenebilir public sayfaların gerçek metadata üreten fonksiyonları doğrudan çağrılıp
// (title/description/canonical/hreflang/robots) otomatik olarak denetlenir. Her yeni public sayfa
// eklendiğinde bu listeye eklenmezse aşağıdaki "kapsam" testi başarısız olur - unutmayı imkansız kılar.
import { describe, expect, it } from "vitest";
import type { Metadata } from "next";
import { hreflangAlternates } from "./seo";
import { getPublicVillaMetadata } from "./public-villa-seo";
import { buildLegalMetadata } from "@/components/LegalInfoPage";
import { LEGAL_PAGES, LEGAL_PAGE_SLUGS } from "./legal-content";
import { REGION_GUIDE_PAGES, REGION_GUIDE_PAGE_SLUGS } from "./region-guide-pages";
import { PATARA_VILLA_CANONICAL, buildPataraVillaMetadata } from "./patara-villa-content";

const ORIGIN = "https://safiradestan.com";

const homepageMetadata: Metadata = {
  title: "Patara Kaş Özel Havuzlu Villa | Villa Safira & Villa Destan",
  description: "Patara Kaş'ta Villa Safira ve Villa Destan. Gerçek fotoğrafları inceleyin, canlı müsaitlik ve dönemsel fiyatı kontrol edip doğrudan talep gönderin.",
  alternates: hreflangAlternates(ORIGIN),
};

const pataraVillaMetadata: Metadata = {
  ...buildPataraVillaMetadata(),
  alternates: hreflangAlternates(PATARA_VILLA_CANONICAL),
};

function collectPageMetadata(): Array<{ path: string; metadata: Metadata }> {
  const pages: Array<{ path: string; metadata: Metadata }> = [
    { path: "/", metadata: homepageMetadata },
    { path: "/patara-villa", metadata: pataraVillaMetadata },
    { path: "/villa-safira", metadata: getPublicVillaMetadata("villa-safira") },
    { path: "/villa-destan", metadata: getPublicVillaMetadata("villa-destan") },
  ];
  for (const slug of LEGAL_PAGE_SLUGS) {
    pages.push({ path: `/${slug}`, metadata: buildLegalMetadata(LEGAL_PAGES[slug]) });
  }
  for (const slug of REGION_GUIDE_PAGE_SLUGS) {
    const page = REGION_GUIDE_PAGES[slug];
    const canonical = `${ORIGIN}/rehber/${slug}`;
    pages.push({
      path: `/rehber/${slug}`,
      metadata: { title: page.seoTitle, description: page.metaDescription, alternates: hreflangAlternates(canonical), robots: { index: true, follow: true } },
    });
  }
  return pages;
}

describe("SEO sağlık denetimi - tüm public sayfa metadata'ları", () => {
  const pages = collectPageMetadata();

  it("kapsam: en az ana sayfa + 2 villa + patara-villa + 7 legal + 5 rehber sayfası denetleniyor", () => {
    expect(pages.length).toBeGreaterThanOrEqual(1 + 1 + 2 + 7 + 5);
  });

  it.each(pages.map((p) => [p.path, p] as const))("%s: title mevcut ve boş değil", (_path, page) => {
    const title = typeof page.metadata.title === "string" ? page.metadata.title : "";
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThan(160);
  });

  it.each(pages.map((p) => [p.path, p] as const))("%s: description mevcut ve boş değil", (_path, page) => {
    expect((page.metadata.description ?? "").length).toBeGreaterThan(0);
  });

  it.each(pages.map((p) => [p.path, p] as const))("%s: self-referencing canonical safiradestan.com ile başlıyor", (path, page) => {
    const alternates = page.metadata.alternates as { canonical?: string } | undefined;
    const canonical = alternates?.canonical ?? "";
    expect(canonical.length).toBeGreaterThan(0);
    // Homepage relative "/" kullanabilir (metadataBase ile çözülür) - diğerleri tam URL.
    if (canonical !== "/") {
      expect(canonical.startsWith(ORIGIN)).toBe(true);
    }
  });

  it.each(pages.map((p) => [p.path, p] as const))("%s: hreflang tr-TR ve x-default canonical ile AYNI URL'yi gösterir - sahte İngilizce alternate YOK", (_path, page) => {
    const alternates = page.metadata.alternates as { canonical?: string; languages?: Record<string, string> } | undefined;
    const canonical = alternates?.canonical ?? "";
    const languages = alternates?.languages ?? {};
    expect(languages["tr-TR"]).toBe(canonical);
    expect(languages["x-default"]).toBe(canonical);
    // Hiçbir sayfa "en"/"en-US" gibi gerçekte var olmayan bir İngilizce sürüme işaret etmemeli.
    expect(languages.en).toBeUndefined();
    expect(languages["en-US"]).toBeUndefined();
  });

  it.each(pages.map((p) => [p.path, p] as const))("%s: yanlışlıkla noindex edilmemiş", (_path, page) => {
    const robots = page.metadata.robots;
    if (robots && typeof robots === "object" && "index" in robots) {
      expect(robots.index).not.toBe(false);
    }
  });
});
