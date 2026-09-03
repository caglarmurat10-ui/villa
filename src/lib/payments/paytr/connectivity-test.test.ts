import { describe, expect, it, vi } from "vitest";
import type { TokenRequestInput, TokenResult } from "./token";

let capturedInput: TokenRequestInput | null = null;
let mockResult: TokenResult = { ok: true, iframeUrl: "https://www.paytr.com/odeme/guvenli/fake" };

vi.mock("./token", () => ({
  requestPaytrToken: async (input: TokenRequestInput) => {
    capturedInput = input;
    return mockResult;
  },
}));

describe("testPaytrConnectivity (PARA HAREKETİ YOK guard testi)", () => {
  it("testMode HER ZAMAN true gonderir - global PAYTR_TEST_MODE durumundan bagimsiz", async () => {
    const { testPaytrConnectivity } = await import("./connectivity-test");
    await testPaytrConnectivity();
    expect(capturedInput?.testMode).toBe(true);
  });

  it("sentetik merchant_oid uretir - gercek bir rezervasyon/payment id'sine asla baglanmaz", async () => {
    const { testPaytrConnectivity } = await import("./connectivity-test");
    await testPaytrConnectivity();
    expect(capturedInput?.merchantOid).toMatch(/^TEST\d+$/);
  });

  it("basarili yanitta ok:true ve okunabilir mesaj doner", async () => {
    mockResult = { ok: true, iframeUrl: "https://www.paytr.com/odeme/guvenli/fake" };
    const { testPaytrConnectivity } = await import("./connectivity-test");
    const result = await testPaytrConnectivity();
    expect(result.ok).toBe(true);
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.testedAt).toBeTruthy();
  });

  it("basarisiz yanitta ok:false ve provider reason'i (varsa) tasir", async () => {
    mockResult = { ok: false, error: "Ödeme oturumu başlatılamadı.", providerReason: "INVALID_MERCHANT" };
    const { testPaytrConnectivity } = await import("./connectivity-test");
    const result = await testPaytrConnectivity();
    expect(result.ok).toBe(false);
    expect(result.providerReason).toBe("INVALID_MERCHANT");
  });

  it("donen sonuc asla gercek bir iframeUrl/token alani icermez (D1'e yazilmadigi gibi cagirana da tasinmaz)", async () => {
    mockResult = { ok: true, iframeUrl: "https://www.paytr.com/odeme/guvenli/fake" };
    const { testPaytrConnectivity } = await import("./connectivity-test");
    const result = await testPaytrConnectivity();
    expect(result).not.toHaveProperty("iframeUrl");
  });
});
