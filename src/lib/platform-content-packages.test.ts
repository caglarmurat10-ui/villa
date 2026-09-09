import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "./test-utils/fake-d1";
import { socialDriveMedia } from "./social-drive-media";

let db: FakeD1;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db } }),
}));

const safiraAsset = socialDriveMedia.find((a) => a.villa === "Safira" && a.mediaKind === "image")!;
const destanAsset = socialDriveMedia.find((a) => a.villa === "Destan" && a.mediaKind === "image")!;

describe("generateAndStorePackages / listPlatformPackages / markPackageManuallyPublished", () => {
  beforeEach(() => {
    db = createFakeD1(""); // self-heal
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("geçerli (REAL_UPLOAD, doğru villa) medya için 5 platform paketi D1'e yazılır", async () => {
    const { generateAndStorePackages } = await import("./platform-content-packages");
    const result = await generateAndStorePackages({ villa: "Safira", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "test" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.packages).toHaveLength(5);
    expect(result.packages.every((p) => p.manualPublishState === "READY_FOR_MANUAL_PUBLISH")).toBe(true);
  });

  it("property isolation ihlali D1'e HİÇBİR satır yazmaz (fail closed - kısmi kayıt yok)", async () => {
    const { generateAndStorePackages, listPlatformPackages } = await import("./platform-content-packages");
    const result = await generateAndStorePackages({ villa: "Destan", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "test" });
    expect(result.ok).toBe(false);
    const rows = await listPlatformPackages();
    expect(rows).toHaveLength(0);
  });

  it("listPlatformPackages villa/platform filtresiyle doğru sonuç döner", async () => {
    const { generateAndStorePackages, listPlatformPackages } = await import("./platform-content-packages");
    await generateAndStorePackages({ villa: "Safira", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "a" });
    await generateAndStorePackages({ villa: "Destan", mediaFileId: destanAsset.fileId, theme: "Bahçe", campaignId: "b" });

    const safiraOnly = await listPlatformPackages({ villa: "Safira" });
    expect(safiraOnly.every((p) => p.villa === "Safira")).toBe(true);
    expect(safiraOnly).toHaveLength(5);

    const pinterestOnly = await listPlatformPackages({ platform: "pinterest" });
    expect(pinterestOnly).toHaveLength(2);
    expect(pinterestOnly.every((p) => p.platform === "pinterest")).toBe(true);
  });

  it("markPackageManuallyPublished: READY -> MANUALLY_PUBLISHED, manuallyPublishedAt dolar", async () => {
    const { generateAndStorePackages, markPackageManuallyPublished } = await import("./platform-content-packages");
    const result = await generateAndStorePackages({ villa: "Safira", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "test" });
    if (!result.ok) throw new Error("setup failed");
    const target = result.packages[0];

    const updated = await markPackageManuallyPublished(target.id);
    expect(updated?.manualPublishState).toBe("MANUALLY_PUBLISHED");
    expect(updated?.manuallyPublishedAt).not.toBeNull();
  });

  it("zaten MANUALLY_PUBLISHED bir paket tekrar işaretlenemez (idempotent, ikinci deneme no-op)", async () => {
    const { generateAndStorePackages, markPackageManuallyPublished } = await import("./platform-content-packages");
    const result = await generateAndStorePackages({ villa: "Safira", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "test" });
    if (!result.ok) throw new Error("setup failed");
    const target = result.packages[0];

    const first = await markPackageManuallyPublished(target.id);
    const firstTimestamp = first?.manuallyPublishedAt;
    const second = await markPackageManuallyPublished(target.id);
    expect(second?.manuallyPublishedAt).toBe(firstTimestamp);
  });

  it("hashtags JSON round-trip ile diziye geri dönüşür (string olarak sızmaz)", async () => {
    const { generateAndStorePackages } = await import("./platform-content-packages");
    const result = await generateAndStorePackages({ villa: "Safira", mediaFileId: safiraAsset.fileId, theme: "Havuz", campaignId: "test" });
    if (!result.ok) throw new Error("setup failed");
    expect(Array.isArray(result.packages[0].hashtags)).toBe(true);
    expect(result.packages[0].hashtags.length).toBeGreaterThan(0);
  });
});
