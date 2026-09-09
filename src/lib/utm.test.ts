import { describe, expect, it } from "vitest";
import { buildUtmUrl, buildUtmUrlForPlatform, isValidUtmToken, normalizeUtmToken, SITE_ORIGIN } from "./utm";

describe("normalizeUtmToken", () => {
  it("küçük harfe çevirir ve Türkçe karakterleri ASCII'ye indirger", () => {
    expect(normalizeUtmToken("Şık Villa Kaş")).toBe("sik_villa_kas");
  });
  it("boşluk/özel karakterleri tek alt çizgiye indirger, baş/son alt çizgiyi keser", () => {
    expect(normalizeUtmToken("  Destan -- Pool!! ")).toBe("destan_pool");
  });
  it("sonuç her zaman isValidUtmToken'ı geçer", () => {
    const examples = ["Destan Havuz", "Reel #001", "Şık/Patara", "üçlü--test"];
    for (const example of examples) {
      expect(isValidUtmToken(normalizeUtmToken(example))).toBe(true);
    }
  });
});

describe("buildUtmUrl", () => {
  it("bölüm 7 örnekleriyle birebir eşleşen bir URL üretir", () => {
    const url = buildUtmUrl({ path: "/villa-destan", source: "instagram", medium: "organic_social", campaign: "destan_pool", content: "reel_001" });
    const parsed = new URL(url);
    expect(parsed.origin).toBe(SITE_ORIGIN);
    expect(parsed.pathname).toBe("/villa-destan");
    expect(parsed.searchParams.get("utm_source")).toBe("instagram");
    expect(parsed.searchParams.get("utm_medium")).toBe("organic_social");
    expect(parsed.searchParams.get("utm_campaign")).toBe("destan_pool");
    expect(parsed.searchParams.get("utm_content")).toBe("reel_001");
  });

  it("campaign/content her zaman normalize edilir - çağıran taraf ham metin geçse bile", () => {
    const url = buildUtmUrl({ path: "/villa-safira", source: "youtube", medium: "organic_video", campaign: "Şık Havuz!" });
    expect(new URL(url).searchParams.get("utm_campaign")).toBe("sik_havuz");
  });

  it("path '/' ile başlamasa bile doğru şekilde birleştirir", () => {
    const url = buildUtmUrl({ path: "villa-destan", source: "facebook", medium: "organic_social", campaign: "test" });
    expect(new URL(url).pathname).toBe("/villa-destan");
  });

  it("content verilmezse utm_content parametresi hiç eklenmez", () => {
    const url = buildUtmUrl({ path: "/", source: "pinterest", medium: "organic_social", campaign: "test" });
    expect(new URL(url).searchParams.has("utm_content")).toBe(false);
  });
});

describe("buildUtmUrlForPlatform", () => {
  it("her platform için doğru varsayılan source/medium kullanır (bölüm 7 örnekleri)", () => {
    expect(new URL(buildUtmUrlForPlatform("instagram", "/villa-destan", "destan_pool")).searchParams.get("utm_source")).toBe("instagram");
    expect(new URL(buildUtmUrlForPlatform("facebook", "/villa-destan", "x")).searchParams.get("utm_medium")).toBe("organic_social");
    expect(new URL(buildUtmUrlForPlatform("youtube_shorts", "/villa-destan", "x")).searchParams.get("utm_source")).toBe("youtube");
    expect(new URL(buildUtmUrlForPlatform("youtube_shorts", "/villa-destan", "x")).searchParams.get("utm_medium")).toBe("organic_video");
    expect(new URL(buildUtmUrlForPlatform("pinterest", "/villa-destan", "x")).searchParams.get("utm_source")).toBe("pinterest");
  });
});
