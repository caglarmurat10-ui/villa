import { afterEach, describe, expect, it, vi } from "vitest";

let mockEnv: Record<string, string> = {};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: mockEnv }),
}));

describe("getMetaAdsReadiness", () => {
  afterEach(() => {
    mockEnv = {};
    vi.resetModules();
  });

  it("ad_account yoksa META_ADS_WAITING_AD_ACCOUNT doner", async () => {
    const { getMetaAdsReadiness } = await import("./readiness");
    const readiness = await getMetaAdsReadiness();
    expect(readiness.state).toBe("META_ADS_WAITING_AD_ACCOUNT");
    expect(readiness.adAccountConfigured).toBe(false);
  });

  it("ad_account varsa bile META_ADS_READY_READ_ONLY OLMAZ - izin dogrulayacak OAuth akisi yok, hep WAITING_PERMISSION", async () => {
    mockEnv = { META_ADS_AD_ACCOUNT_ID: "act_123" };
    const { getMetaAdsReadiness } = await import("./readiness");
    const readiness = await getMetaAdsReadiness();
    expect(readiness.state).toBe("META_ADS_WAITING_PERMISSION");
    expect(readiness.state).not.toBe("META_ADS_READY_READ_ONLY");
  });

  it("missing listesi her zaman ads_management/ads_read iznini ayrica belirtir - organik baglantiyla karistirilmaz", async () => {
    const { getMetaAdsReadiness } = await import("./readiness");
    const readiness = await getMetaAdsReadiness();
    expect(readiness.missing.some((m) => m.includes("ads_management") || m.includes("ads_read"))).toBe(true);
  });
});
