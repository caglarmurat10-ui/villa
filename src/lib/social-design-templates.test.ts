// FAZ 5 son denetim düzeltmesi (bölüm 9/12) - public, kimliksiz Social Design Engine rotasının
// (src/app/api/public/social-assets/[id]/[format]/route.tsx) allowlist mantığını doğrular.
// ImageResponse/Satori render'ının kendisi (gerçek PNG üretimi) bu ortamda pratik olarak test
// edilemiyor (ne bu dosyada ne de projenin diğer iki mevcut ImageResponse rotasında - hiçbiri
// test edilmiyor); burada asıl güvenlik-kritik katman doğrulanıyor: [id] YALNIZ sabit/gerçek
// listelere (Villa, TemplateType, GUIDE_PLACES, EVERGREEN_TIPS) karşı ayrıştırılır, serbest metin
// kabul edilmez.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isFormat, isTemplateType, isVilla, parseTemplateId, EVERGREEN_TIPS } from "./social-design-templates";
import { GUIDE_PLACES } from "./region-guide";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

describe("parseTemplateId (public design asset allowlist)", () => {
  it("gerçek bir GUIDE_PLACES id'siyle geçerli destination id'sini kabul eder", () => {
    const placeId = GUIDE_PLACES[0].id;
    const parsed = parseTemplateId(`safira_destination_${placeId}`);
    expect(parsed).toEqual({ villa: "Safira", type: "destination", key: placeId });
  });

  it("gecerli bir travel-tip id'sini kabul eder", () => {
    expect(parseTemplateId("destan_travel-tip_0")).toEqual({ villa: "Destan", type: "travel-tip", key: "0" });
  });

  it("bilinmeyen villa'yı REDDEDER", () => {
    expect(parseTemplateId("paris_destination_patara-plaji")).toBeNull();
  });

  it("bilinmeyen/serbest metin type'ı REDDEDER (arbitrary template injection)", () => {
    expect(parseTemplateId("safira_<script>alert(1)</script>_x")).toBeNull();
  });

  it("eksik/fazla segment içeren id'yi REDDEDER", () => {
    expect(parseTemplateId("safira_destination")).toBeNull();
    expect(parseTemplateId("safira_destination_a_b")).toBeNull();
  });

  it("bos string'i REDDEDER", () => {
    expect(parseTemplateId("")).toBeNull();
  });
});

describe("isFormat / isTemplateType / isVilla", () => {
  it("yalnız feed/story format kabul eder", () => {
    expect(isFormat("feed")).toBe(true);
    expect(isFormat("story")).toBe(true);
    expect(isFormat("square")).toBe(false);
    expect(isFormat("")).toBe(false);
  });

  it("yalnız 5 sabit template türünü kabul eder", () => {
    expect(isTemplateType("offer")).toBe(true);
    expect(isTemplateType("random-type")).toBe(false);
  });

  it("yalnız Safira/Destan villa degerini kabul eder", () => {
    expect(isVilla("Safira")).toBe(true);
    expect(isVilla("Bilinmeyen")).toBe(false);
  });
});

describe("EVERGREEN_TIPS içerik güvenliği", () => {
  it("hiçbir ipucu değişken bilgi (fiyat/saat/hava/tarih) içermez", () => {
    const variablePatterns = [/\d+\s?(tl|₺|try)\b/i, /\b\d{1,2}[:.]\d{2}\b/, /hava durumu|\d+\s?derece/i];
    for (const tip of EVERGREEN_TIPS) {
      for (const pattern of variablePatterns) {
        expect(pattern.test(tip)).toBe(false);
      }
    }
  });
});

describe("Public social design route - admin oturumu olmadan erişilebilir (regresyon)", () => {
  it("custom-worker.mjs adminAuthGate, /api/public/social-assets/ önekini muaf tutar", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain('url.pathname.startsWith("/api/public/social-assets/")');
  });
});
