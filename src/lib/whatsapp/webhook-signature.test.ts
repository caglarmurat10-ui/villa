import { describe, expect, it } from "vitest";
import { verifyWhatsappWebhookSignature } from "./webhook-signature";

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("verifyWhatsappWebhookSignature", () => {
  const appSecret = "test-app-secret";
  const rawBody = JSON.stringify({ entry: [{ changes: [] }] });

  it("doğru şekilde hesaplanmış bir imzayı kabul eder", async () => {
    const validSignature = `sha256=${await hmacHex(appSecret, rawBody)}`;
    expect(await verifyWhatsappWebhookSignature(appSecret, rawBody, validSignature)) .toBe(true);
  });

  it("yanlış secret ile üretilmiş imzayı reddeder", async () => {
    const wrongSignature = `sha256=${await hmacHex("wrong-secret", rawBody)}`;
    expect(await verifyWhatsappWebhookSignature(appSecret, rawBody, wrongSignature)).toBe(false);
  });

  it("gövde değiştirilmişse (imza eski gövdeye ait) reddeder", async () => {
    const signatureForOriginal = `sha256=${await hmacHex(appSecret, rawBody)}`;
    const tamperedBody = rawBody + "tampered";
    expect(await verifyWhatsappWebhookSignature(appSecret, tamperedBody, signatureForOriginal)).toBe(false);
  });

  it("başlık eksikse reddeder", async () => {
    expect(await verifyWhatsappWebhookSignature(appSecret, rawBody, null)).toBe(false);
  });

  it("'sha256=' öneki olmayan başlığı reddeder", async () => {
    const rawHex = await hmacHex(appSecret, rawBody);
    expect(await verifyWhatsappWebhookSignature(appSecret, rawBody, rawHex)).toBe(false);
  });
});
