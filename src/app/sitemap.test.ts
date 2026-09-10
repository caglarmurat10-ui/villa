import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import robots from "./robots";

const ORIGIN = "https://safiradestan.com";

describe("sitemap.xml", () => {
  const entries = sitemap();

  it("her URL safiradestan.com ile başlar ve https kullanır", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(ORIGIN)).toBe(true);
    }
  });

  it("hiçbir URL tekrar etmez (duplicate route variant yok)", () => {
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("kritik sayfaları içerir: /, /villa-safira, /villa-destan, /patara-villa", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${ORIGIN}/`);
    expect(urls).toContain(`${ORIGIN}/villa-safira`);
    expect(urls).toContain(`${ORIGIN}/villa-destan`);
    expect(urls).toContain(`${ORIGIN}/patara-villa`);
  });

  it("hiçbir URL /site/ internal rewrite hedefine işaret etmez (yalnız public URL'ler)", () => {
    for (const entry of entries) {
      expect(entry.url).not.toContain("/site/");
    }
  });

  it("ana sayfa ve villa sayfaları resim (image sitemap) girdisi taşır", () => {
    const home = entries.find((e) => e.url === `${ORIGIN}/`);
    const safira = entries.find((e) => e.url === `${ORIGIN}/villa-safira`);
    expect(home?.images?.length).toBeGreaterThan(0);
    expect(safira?.images?.length).toBeGreaterThan(0);
  });

  it("villa sayfaları yalnız hero değil, TÜM gerçek galeri fotoğraflarını görsel sitemap'e dahil eder", () => {
    const safira = entries.find((e) => e.url === `${ORIGIN}/villa-safira`);
    const destan = entries.find((e) => e.url === `${ORIGIN}/villa-destan`);
    // villa-content.ts'teki gerçek galeri en az 10 fotoğraf içeriyor (bkz. round 4/5 içerik) -
    // yalnız 1-2 hero görseline geri düşülmediğini doğrular.
    expect(safira?.images?.length ?? 0).toBeGreaterThan(5);
    expect(destan?.images?.length ?? 0).toBeGreaterThan(5);
    for (const url of safira?.images ?? []) expect(url.startsWith(ORIGIN)).toBe(true);
  });

  it("yeni bölge rehberlerini (xanthos/saklikent/yerel-pazar) içerir", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${ORIGIN}/rehber/xanthos`);
    expect(urls).toContain(`${ORIGIN}/rehber/saklikent`);
    expect(urls).toContain(`${ORIGIN}/rehber/yerel-pazar`);
  });

  it("her URL robots.ts'in izin verdiği (allow) yollarla tutarlı - sitemap'te olup robots'ta yasak bir yol yok", () => {
    const robotsConfig = robots();
    const rule = Array.isArray(robotsConfig.rules) ? robotsConfig.rules[0] : robotsConfig.rules;
    const disallow = (Array.isArray(rule?.disallow) ? rule?.disallow : [rule?.disallow]).filter(Boolean) as string[];
    for (const entry of entries) {
      const path = entry.url.replace(ORIGIN, "") || "/";
      const isDisallowed = disallow.some((prefix) => path.startsWith(prefix));
      expect(isDisallowed).toBe(false);
    }
  });
});

describe("robots.txt", () => {
  const config = robots();

  it("sitemap ve host doğru şekilde tanımlı", () => {
    expect(config.sitemap).toBe(`${ORIGIN}/sitemap.xml`);
    expect(config.host).toBe(ORIGIN);
  });

  it("/api/ ve /site/ (internal rewrite hedefleri) disallow edilir", () => {
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    const disallow = Array.isArray(rule?.disallow) ? rule?.disallow : [rule?.disallow];
    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/site/");
  });

  it("/patara-villa allow listesinde", () => {
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    const allow = Array.isArray(rule?.allow) ? rule?.allow : [rule?.allow];
    expect(allow).toContain("/patara-villa");
  });
});
