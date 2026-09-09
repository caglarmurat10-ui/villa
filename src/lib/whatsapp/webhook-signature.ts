import { timingSafeEqual } from "../payments/crypto";

// Meta'nın X-Hub-Signature-256 başlığı "sha256=<hex digest>" biçiminde HEX kodlu bir HMAC taşır
// (payments/crypto.ts'teki hmacSha256Base64 PayTR için BASE64 üretiyor - format farklı, bu yüzden
// ayrı bir hex fonksiyonu). Ham istek gövdesi (raw body, parse edilmemiş) üzerinden hesaplanmalı.
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyWhatsappWebhookSignature(appSecret: string, rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length).trim().toLowerCase();
  const expected = await hmacSha256Hex(appSecret, rawBody);
  return timingSafeEqual(provided, expected);
}
