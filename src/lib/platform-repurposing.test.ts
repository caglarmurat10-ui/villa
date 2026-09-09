import { describe, expect, it } from "vitest";
import { buildPlatformPackages, ORGANIC_PLATFORMS } from "./platform-repurposing";
import { socialDriveMedia } from "./social-drive-media";

const safiraAsset = socialDriveMedia.find((a) => a.villa === "Safira" && a.mediaKind === "image")!;
const destanAsset = socialDriveMedia.find((a) => a.villa === "Destan" && a.mediaKind === "image")!;

describe("buildPlatformPackages", () => {
  it("gerçek Safira medyası + Safira villa -> 5 platform paketi üretir, her biri farklı caption taşır", () => {
    const result = buildPlatformPackages({ villa: "Safira", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "test_campaign" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.packages).toHaveLength(ORGANIC_PLATFORMS.length);
    const captions = result.packages.map((p) => p.caption);
    // Aynı metnin kopyası DEĞİL - her platformun caption'ı farklı olmalı.
    expect(new Set(captions).size).toBe(captions.length);
  });

  it("property isolation: Safira medyası Destan kampanyasında REDDEDİLİR (fail closed)", () => {
    const result = buildPlatformPackages({ villa: "Destan", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "test" });
    expect(result.ok).toBe(false);
  });

  it("property isolation: Destan medyası Safira kampanyasında REDDEDİLİR (fail closed)", () => {
    const result = buildPlatformPackages({ villa: "Safira", mediaFileId: destanAsset.fileId, theme: "Havuz", campaignId: "test" });
    expect(result.ok).toBe(false);
  });

  it("bilinmeyen/kayıtsız medya fileId'si REDDEDİLİR", () => {
    const result = buildPlatformPackages({ villa: "Safira", mediaFileId: "nonexistent-id", theme: "Havuz", campaignId: "test" });
    expect(result.ok).toBe(false);
  });

  it("AI_GENERATED/OTHER kaynaklı medya (varsayımsal) REDDEDİLİR - REAL_UPLOAD zorunlu", () => {
    const original = safiraAsset.sourceOrigin;
    (safiraAsset as { sourceOrigin: string }).sourceOrigin = "AI_GENERATED";
    try {
      const result = buildPlatformPackages({ villa: "Safira", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "test" });
      expect(result.ok).toBe(false);
    } finally {
      (safiraAsset as { sourceOrigin: string }).sourceOrigin = original;
    }
  });

  it("her paket geçerli, tam bir UTM URL taşır (source/medium/campaign hepsi dolu)", () => {
    const result = buildPlatformPackages({ villa: "Destan", mediaFileId: destanAsset.fileId, theme: "Bahçe", campaignId: "destan_garden" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const pkg of result.packages) {
      const url = new URL(pkg.utmUrl);
      expect(url.searchParams.get("utm_source")).toBeTruthy();
      expect(url.searchParams.get("utm_medium")).toBeTruthy();
      expect(url.searchParams.get("utm_campaign")).toBe("destan_garden");
    }
  });

  it("YouTube Shorts ve Pinterest başlık (title) taşır; Instagram/TikTok başlıksız kalabilir", () => {
    const result = buildPlatformPackages({ villa: "Safira", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "test" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const youtube = result.packages.find((p) => p.platform === "youtube_shorts")!;
    const pinterest = result.packages.find((p) => p.platform === "pinterest")!;
    expect(youtube.title).toBeTruthy();
    expect(pinterest.title).toBeTruthy();
  });

  it("dikey (9:16) formatlar YouTube Shorts ve TikTok için önerilir", () => {
    const result = buildPlatformPackages({ villa: "Safira", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "test" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.packages.find((p) => p.platform === "youtube_shorts")?.recommendedRatio).toBe("9:16");
    expect(result.packages.find((p) => p.platform === "tiktok")?.recommendedRatio).toBe("9:16");
  });

  it("her paket kaynağı, gerçek medya fileId'sini taşır (uydurma medya referansı yok)", () => {
    const result = buildPlatformPackages({ villa: "Safira", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "test" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const pkg of result.packages) {
      expect(pkg.sourceFileId).toBe(safiraAsset.fileId);
    }
  });
});
