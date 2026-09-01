import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Villa } from "@/lib/types";
import type { OtaPlatform } from "./types";

// Airbnb/Booking import URL'leri ve bizim export feed token'larımız - hepsi OTA_PRIVATE'ta, D1'e
// asla yazılmaz. META_PRIVATE'tan bilerek AYRI bir namespace: farklı hassasiyet seviyesi, ortak
// namespace paylaşımı ileride bir debug/log hatasının hava durumu/Reviews cache'iyle birlikte OTA
// secret'larını da sızdırma riskini büyütür.

async function kv() {
  const { env } = await getCloudflareContext({ async: true });
  return env.OTA_PRIVATE;
}

function importUrlKey(villa: Villa, platform: OtaPlatform) {
  return `import-url:${villa}:${platform}`;
}

export async function getImportUrl(villa: Villa, platform: OtaPlatform): Promise<string | null> {
  const store = await kv();
  return store.get(importUrlKey(villa, platform));
}

// Gerçek Airbnb/Booking import URL'leri elimize geçtiğinde `wrangler kv key put` ile (bash-only,
// secret-safe) tek tek yazılır. Bilerek bir HTTP "set URL" endpoint'i YOK - böyle bir endpoint
// kendi başına yeni bir saldırı yüzeyi (arbitrary URL kabul eden bir yazma yolu) olurdu.
export async function setImportUrl(villa: Villa, platform: OtaPlatform, url: string): Promise<void> {
  const store = await kv();
  await store.put(importUrlKey(villa, platform), url);
}

interface ExportTokenRecord {
  villa: Villa;
  excludeSource: OtaPlatform;
}

function exportTokenKey(token: string) {
  return `export-token:${token}`;
}

function exportTokenForKey(villa: Villa, platform: OtaPlatform) {
  return `export-token-for:${villa}:${platform}`;
}

export async function resolveExportToken(token: string): Promise<ExportTokenRecord | null> {
  const store = await kv();
  const raw = await store.get(exportTokenKey(token));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ExportTokenRecord;
    return parsed.villa && parsed.excludeSource ? parsed : null;
  } catch {
    return null;
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Villa+platform başına export token'ı tembel (lazy) üretir - ilk istekte oluşturulur, rotate
// edilene kadar aynı token döner. Token opak (256 bit rastgele hex): URL'den villa/platform
// tahmin edilemez, eşleme yalnızca KV'de (resolveExportToken).
export async function getOrCreateExportToken(villa: Villa, platform: OtaPlatform): Promise<string> {
  const store = await kv();
  const forKey = exportTokenForKey(villa, platform);
  const existing = await store.get(forKey);
  if (existing) return existing;

  const token = randomToken();
  const record: ExportTokenRecord = { villa, excludeSource: platform };
  await store.put(exportTokenKey(token), JSON.stringify(record));
  await store.put(forKey, token);
  return token;
}

// İleride "Takvim bağlantısını yenile" admin aksiyonu için hazır - eski token'ı geçersiz kılar.
// Otomatik/zamanlanmış çağrılmaz (mevcut Airbnb/Booking bağlantısını yanlışlıkla kırmamak için).
export async function rotateExportToken(villa: Villa, platform: OtaPlatform): Promise<string> {
  const store = await kv();
  const forKey = exportTokenForKey(villa, platform);
  const previous = await store.get(forKey);
  const token = randomToken();
  const record: ExportTokenRecord = { villa, excludeSource: platform };
  await store.put(exportTokenKey(token), JSON.stringify(record));
  await store.put(forKey, token);
  if (previous) await store.delete(exportTokenKey(previous));
  return token;
}
