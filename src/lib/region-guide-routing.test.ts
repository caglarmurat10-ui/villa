// src/middleware.ts VE custom-worker.mjs, "@/" alias'ı çözemeyen custom-worker.mjs'in
// middleware.ts'i import EDEMEMESİ yüzünden REGION_GUIDE_SLUGS dizisinin BAĞIMSIZ birer kopyasını
// taşır (bkz. her iki dosyadaki yorum notu). Yeni bir /rehber alt sayfası eklenirken bu iki dizi
// senkron kalmazsa route sessizce 404 verir - bu regresyon testi ikisinin de aynı slug kümesini
// taşıdığını doğrular (whatsapp-cron-wiring.test.ts / gbp-cron-wiring.test.ts ile aynı desen).
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REGION_GUIDE_PAGE_SLUGS } from "./region-guide-pages";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

function extractSlugArray(source: string): string[] {
  const match = source.match(/const REGION_GUIDE_SLUGS = \[([^\]]+)\];/);
  if (!match) throw new Error("REGION_GUIDE_SLUGS dizisi bulunamadı");
  return Array.from(match[1].matchAll(/"([^"]+)"/g)).map((m) => m[1]);
}

describe("Bölge rehberi route kablolaması (middleware.ts <-> custom-worker.mjs <-> region-guide-pages.ts)", () => {
  it("middleware.ts'teki REGION_GUIDE_SLUGS, region-guide-pages.ts'teki gerçek sayfa kümesiyle birebir aynı", () => {
    const source = readFileSync(resolve(ROOT, "src", "middleware.ts"), "utf-8");
    const slugs = extractSlugArray(source);
    expect(new Set(slugs)).toEqual(new Set(REGION_GUIDE_PAGE_SLUGS));
  });

  it("custom-worker.mjs'teki REGION_GUIDE_SLUGS, region-guide-pages.ts'teki gerçek sayfa kümesiyle birebir aynı", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    const slugs = extractSlugArray(source);
    expect(new Set(slugs)).toEqual(new Set(REGION_GUIDE_PAGE_SLUGS));
  });

  it("yeni eklenen xanthos/saklikent/yerel-pazar üçü de her iki dosyada da mevcut", () => {
    const middlewareSource = readFileSync(resolve(ROOT, "src", "middleware.ts"), "utf-8");
    const workerSource = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    for (const slug of ["xanthos", "saklikent", "yerel-pazar"]) {
      expect(extractSlugArray(middlewareSource)).toContain(slug);
      expect(extractSlugArray(workerSource)).toContain(slug);
    }
  });
});
