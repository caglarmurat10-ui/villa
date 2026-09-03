import { afterEach, describe, expect, it, vi } from "vitest";

let mockEnv: Record<string, string> = {};
let mockGbpConnected = false;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: mockEnv }),
}));
vi.mock("../google-api", () => ({
  hasGoogleConnection: async (scope: string) => (scope === "google_ads" ? mockGbpConnected : false),
}));

describe("getGoogleAdsReadiness", () => {
  afterEach(() => {
    mockEnv = {};
    mockGbpConnected = false;
    vi.resetModules();
  });

  it("hicbir sey yapilandirilmamissa GOOGLE_ADS_WAITING_OAUTH doner (ilk gerekli kosul)", async () => {
    const { getGoogleAdsReadiness } = await import("./readiness");
    const readiness = await getGoogleAdsReadiness();
    expect(readiness.state).toBe("GOOGLE_ADS_WAITING_OAUTH");
    expect(readiness.missing.length).toBeGreaterThan(0);
  });

  it("OAuth var ama developer token yoksa GOOGLE_ADS_WAITING_DEVELOPER_TOKEN doner", async () => {
    mockGbpConnected = true;
    const { getGoogleAdsReadiness } = await import("./readiness");
    const readiness = await getGoogleAdsReadiness();
    expect(readiness.state).toBe("GOOGLE_ADS_WAITING_DEVELOPER_TOKEN");
  });

  it("OAuth+token var ama customer ID yoksa GOOGLE_ADS_WAITING_CUSTOMER_ID doner", async () => {
    mockGbpConnected = true;
    mockEnv = { GOOGLE_ADS_DEVELOPER_TOKEN: "x" };
    const { getGoogleAdsReadiness } = await import("./readiness");
    const readiness = await getGoogleAdsReadiness();
    expect(readiness.state).toBe("GOOGLE_ADS_WAITING_CUSTOMER_ID");
  });

  it("ucu de varsa GOOGLE_ADS_READY_READ_ONLY doner - hicbir zaman otomatik ACTIVE/spend durumu yok", async () => {
    mockGbpConnected = true;
    mockEnv = { GOOGLE_ADS_DEVELOPER_TOKEN: "x", GOOGLE_ADS_CUSTOMER_ID: "123-456-7890" };
    const { getGoogleAdsReadiness } = await import("./readiness");
    const readiness = await getGoogleAdsReadiness();
    expect(readiness.state).toBe("GOOGLE_ADS_READY_READ_ONLY");
    // Tip sisteminde "ACTIVE" veya harcama baslatan bir state hic yok - literal union bunu garanti eder.
  });
});
