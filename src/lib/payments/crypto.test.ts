import { describe, expect, it } from "vitest";
import { generatePaymentId, hmacSha256Base64, timingSafeEqual } from "./crypto";

describe("hmacSha256Base64", () => {
  it("bilinen bir HMAC-SHA256+base64 test vektorunu uretir", async () => {
    // key="key", message="The quick brown fox jumps over the lazy dog"
    // node crypto.createHmac('sha256','key') ile bagimsiz dogrulandi (hex: f7bc83f4...a3cd8)
    const result = await hmacSha256Base64("key", "The quick brown fox jumps over the lazy dog");
    expect(result).toBe("97yD9DBThCSxMpjmqm+xQ+9NWaFJRhdZl0edvC0aPNg=");
  });

  it("PayTR alan siralamasiyla ayni girdi icin deterministiktir", async () => {
    const a = await hmacSha256Base64("merchant-key", "oid123saltsuccess1000");
    const b = await hmacSha256Base64("merchant-key", "oid123saltsuccess1000");
    expect(a).toBe(b);
  });
});

describe("timingSafeEqual", () => {
  it("ayni stringler icin true doner", () => {
    expect(timingSafeEqual("abc123==", "abc123==")).toBe(true);
  });

  it("farkli icerik icin false doner", () => {
    expect(timingSafeEqual("abc123==", "xyz789==")).toBe(false);
  });

  it("farkli uzunluk icin false doner (erken cikis, guvenli)", () => {
    expect(timingSafeEqual("short", "muchlongerstring")).toBe(false);
  });

  it("bos stringleri esit sayar", () => {
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("PayTR callback hash dogrulama senaryosunu simule eder", async () => {
    const merchantKey = "test-merchant-key";
    const hashStr = "oid-1testsaltsuccess1500";
    const expected = await hmacSha256Base64(merchantKey, hashStr);
    // Gercek callback ayni hash'i gonderirse dogrulama gecmeli
    expect(timingSafeEqual(expected, expected)).toBe(true);
    // Sahte/bozuk bir hash reddedilmeli
    expect(timingSafeEqual(expected, "sahte-hash")).toBe(false);
  });
});

describe("generatePaymentId", () => {
  it("PayTR merchant_oid kisitina uyar: yalniz alfanumerik, tire yok", () => {
    const id = generatePaymentId();
    expect(id).toMatch(/^[a-f0-9]{32}$/);
  });

  it("her cagrida farkli deger uretir", () => {
    const a = generatePaymentId();
    const b = generatePaymentId();
    expect(a).not.toBe(b);
  });
});
