import { describe, expect, it } from "vitest";
import { approvedProxyMediaAsset, socialDriveMedia } from "./social-drive-media";

const ALLOWED_ORIGINS = ["https://safiradestan.com", "https://villa-yonetim.caglarmurat10.workers.dev"];

const safiraAsset = socialDriveMedia.find((asset) => asset.villa === "Safira" && asset.mediaKind === "image")!;
const destanAsset = socialDriveMedia.find((asset) => asset.villa === "Destan" && asset.mediaKind === "image")!;

function proxyUrl(fileId: string, origin = ALLOWED_ORIGINS[0]) {
  return `${origin}/api/media/drive/${fileId}`;
}

describe("socialDriveMedia — envanter bütünlüğü", () => {
  it("hiçbir fileId tekrar etmiyor (2026-09-10'da elle eklenen 102 yeni kayıtta kopya yok)", () => {
    const ids = socialDriveMedia.map((asset) => asset.fileId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hiçbir fileName aynı villa içinde tekrar etmiyor", () => {
    const keys = socialDriveMedia.map((asset) => `${asset.villa}:${asset.fileName}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("Safira ve Destan'ın her ikisinin de en az bir video ve çok sayıda gerçek fotoğrafı var", () => {
    for (const villa of ["Safira", "Destan"] as const) {
      const villaAssets = socialDriveMedia.filter((asset) => asset.villa === villa);
      expect(villaAssets.filter((a) => a.mediaKind === "video").length).toBeGreaterThanOrEqual(1);
      expect(villaAssets.filter((a) => a.mediaKind === "image").length).toBeGreaterThan(40);
    }
  });
});

describe("approvedProxyMediaAsset — property (villa) isolation", () => {
  it("Safira media cannot target Destan (property mismatch rejected)", () => {
    const result = approvedProxyMediaAsset("Destan", proxyUrl(safiraAsset.fileId), ALLOWED_ORIGINS);
    expect(result).toBeNull();
  });

  it("Destan media cannot target Safira (property mismatch rejected)", () => {
    const result = approvedProxyMediaAsset("Safira", proxyUrl(destanAsset.fileId), ALLOWED_ORIGINS);
    expect(result).toBeNull();
  });

  it("Safira media approved for Safira", () => {
    const result = approvedProxyMediaAsset("Safira", proxyUrl(safiraAsset.fileId), ALLOWED_ORIGINS);
    expect(result?.fileId).toBe(safiraAsset.fileId);
  });

  it("Destan media approved for Destan", () => {
    const result = approvedProxyMediaAsset("Destan", proxyUrl(destanAsset.fileId), ALLOWED_ORIGINS);
    expect(result?.fileId).toBe(destanAsset.fileId);
  });

  it("unknown property/villa cannot resolve any media (no such villa in the whitelist)", () => {
    // @ts-expect-error - deliberately passing an invalid villa to prove the gate fails closed
    const result = approvedProxyMediaAsset("UnknownVilla", proxyUrl(safiraAsset.fileId), ALLOWED_ORIGINS);
    expect(result).toBeNull();
  });

  it("unregistered fileId (unknown media) cannot auto-publish for any villa", () => {
    const result = approvedProxyMediaAsset("Safira", proxyUrl("nonexistent-file-id-12345"), ALLOWED_ORIGINS);
    expect(result).toBeNull();
  });
});

describe("approvedProxyMediaAsset — media provenance gate (source_origin)", () => {
  it("every entry in the live whitelist is explicitly REAL_UPLOAD (no implicit/default provenance)", () => {
    for (const asset of socialDriveMedia) {
      expect(asset.sourceOrigin).toBe("REAL_UPLOAD");
    }
  });

  it("AI_GENERATED media cannot auto-publish even when the villa/property matches", () => {
    // Simulates a future whitelist entry that was never marked REAL_UPLOAD - the gate must
    // reject it purely on sourceOrigin, independent of the villa match.
    const aiGeneratedFileId = safiraAsset.fileId;
    const originalOrigin = safiraAsset.sourceOrigin;
    (safiraAsset as { sourceOrigin: string }).sourceOrigin = "AI_GENERATED";
    try {
      const result = approvedProxyMediaAsset("Safira", proxyUrl(aiGeneratedFileId), ALLOWED_ORIGINS);
      expect(result).toBeNull();
    } finally {
      (safiraAsset as { sourceOrigin: string }).sourceOrigin = originalOrigin;
    }
  });

  it("OTHER/unknown-origin media cannot auto-publish even when the villa/property matches", () => {
    const fileId = destanAsset.fileId;
    const originalOrigin = destanAsset.sourceOrigin;
    (destanAsset as { sourceOrigin: string }).sourceOrigin = "OTHER";
    try {
      const result = approvedProxyMediaAsset("Destan", proxyUrl(fileId), ALLOWED_ORIGINS);
      expect(result).toBeNull();
    } finally {
      (destanAsset as { sourceOrigin: string }).sourceOrigin = originalOrigin;
    }
  });
});

describe("approvedProxyMediaAsset — origin allowlist", () => {
  it("rejects a proxy URL served from an origin outside the allowlist", () => {
    const result = approvedProxyMediaAsset("Safira", proxyUrl(safiraAsset.fileId, "https://evil.example.com"), ALLOWED_ORIGINS);
    expect(result).toBeNull();
  });
});
