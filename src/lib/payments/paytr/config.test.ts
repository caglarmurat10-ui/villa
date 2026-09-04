import { afterEach, describe, expect, it, vi } from "vitest";

const envBase = { PAYTR_MERCHANT_ID: "", PAYTR_MERCHANT_KEY: "", PAYTR_MERCHANT_SALT: "" };
let mockEnv: Record<string, string> = { ...envBase };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: mockEnv }),
}));

describe("getPaytrReadiness", () => {
  afterEach(() => {
    mockEnv = { ...envBase };
    vi.resetModules();
  });

  it("secret eksikse PAYTR_NOT_CONFIGURED doner, hicbir checklist maddesi kendiliginden VERIFIED olmaz", async () => {
    const { getPaytrReadiness } = await import("./config");
    const readiness = await getPaytrReadiness();
    expect(readiness.state).toBe("PAYTR_NOT_CONFIGURED");
    expect(readiness.configured).toBe(false);
    expect(readiness.merchantPanelChecklist.every((item) => item.status !== "VERIFIED")).toBe(true);
  });

  it("secretler varken ve PAYTR_TEST_MODE=false (kod sabiti) iken PAYTR_READY doner", async () => {
    mockEnv = { PAYTR_MERCHANT_ID: "x", PAYTR_MERCHANT_KEY: "y", PAYTR_MERCHANT_SALT: "z" };
    const { getPaytrReadiness } = await import("./config");
    const readiness = await getPaytrReadiness();
    expect(readiness.configured).toBe(true);
    expect(readiness.testMode).toBe(false); // types.ts: PAYTR_TEST_MODE = false (hardcoded)
    expect(readiness.state).toBe("PAYTR_READY");
    expect(readiness.state).not.toBe("PAYTR_TEST_MODE_ONLY");
  });

  it("'Canliya izin verildi' maddesi disindaki HICBIR checklist maddesi otomatik VERIFIED olamaz", async () => {
    mockEnv = { PAYTR_MERCHANT_ID: "x", PAYTR_MERCHANT_KEY: "y", PAYTR_MERCHANT_SALT: "z" };
    const { getPaytrReadiness } = await import("./config");
    const readiness = await getPaytrReadiness();
    const manualOnlyItems = readiness.merchantPanelChecklist.filter((item) => item.label !== "Canlı moda kullanıcı tarafından ayrıca izin verildi");
    expect(manualOnlyItems.every((item) => item.status === "MANUAL_ONLY")).toBe(true);
  });

  it("callback URL her zaman gercek production endpoint'i gosterir", async () => {
    mockEnv = { PAYTR_MERCHANT_ID: "x", PAYTR_MERCHANT_KEY: "y", PAYTR_MERCHANT_SALT: "z" };
    const { getPaytrReadiness, PAYTR_CALLBACK_URL } = await import("./config");
    expect(PAYTR_CALLBACK_URL).toBe("https://safiradestan.com/api/payments/paytr/callback");
    const readiness = await getPaytrReadiness();
    expect(readiness.callbackUrl).toBe(PAYTR_CALLBACK_URL);
  });
});
