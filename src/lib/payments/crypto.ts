// PayTR'ın resmi Node SDK'sı (npm "iyzipay" hatasına düşmemek için not: PayTR için de aynı durum
// geçerli - resmi paytr GitHub organizasyonunda yalnız PHP eklentileri var, Node/Workers uyumlu resmi
// SDK yok) Node'un yerleşik crypto modülüne bağımlı - Cloudflare Workers'ta çalışmaz. Bu yüzden
// PayTR'ın HMAC-SHA256+base64 imza şemasını burada Web Crypto (crypto.subtle) ile kendimiz üretiyoruz.

export async function hmacSha256Base64(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// PayTR merchant_oid: yalnız alfanumerik, max 64 karakter (resmi dokümanla doğrulandı - tire/alt
// çizgi kabul edilmiyor). crypto.randomUUID()'nin tirelerini kaldırarak üretiyoruz - aynı değeri
// payments.id olarak da kullanıyoruz (tek kimlik, ayrı ID eşleştirme gerekmiyor).
export function generatePaymentId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
