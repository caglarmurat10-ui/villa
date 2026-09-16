// Mobil cihaz eşleştirme (pairing) ve cihaz oturumu yardımcıları.
//
// Kod üretimi/doğrulaması burada saf fonksiyonlar olarak durur; D1 erişimi API route'larında,
// kod tüketimi ise custom-worker.mjs'deki handleMobilePair() içindedir. Ham kod hiçbir zaman
// kalıcı olarak saklanmaz - yalnız SHA-256 hash'i (mobile_pairing_codes.code_hash) yazılır.

export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_TTL_SECONDS = 10 * 60;

export type PairingCodeStatus = "active" | "expired" | "used";

export type PairingCodeRow = {
  id: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

export type MobileSessionRow = {
  id: string;
  device_label: string | null;
  platform: string | null;
  app_version: string | null;
  app_build: string | null;
  created_at: string;
  expires_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

export type MobileDeviceView = {
  id: string;
  deviceLabel: string;
  platform: "ios" | "android" | "bilinmiyor";
  appVersion: string | null;
  appBuild: string | null;
  pairedAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  active: boolean;
  revokedAt: string | null;
};

/**
 * Kriptografik olarak güvenli, modulo bias içermeyen 6 haneli kod üretir.
 *
 * Basit `byte % 10` yaklaşımı yanlıdır (256, 10'a tam bölünmediği için 0-5 rakamları
 * 6-9'dan daha olasıdır). Burada 250'nin üzerindeki baytlar reddedilerek (rejection
 * sampling) her rakam eşit olasılıklı hale getirilir.
 */
export function generatePairingCode(randomBytes: (size: number) => Uint8Array = defaultRandomBytes): string {
  const digits: string[] = [];
  while (digits.length < PAIRING_CODE_LENGTH) {
    const chunk = randomBytes(PAIRING_CODE_LENGTH);
    for (const byte of chunk) {
      if (byte >= 250) continue; // 250..255 reddedilir -> kalan 250 değer 10'a tam bölünür
      digits.push((byte % 10).toString());
      if (digits.length === PAIRING_CODE_LENGTH) break;
    }
  }
  return digits.join("");
}

function defaultRandomBytes(size: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(size));
}

export async function hashPairingCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Kullanıcı girdisinden yalnız rakamları alır; geçersizse null döner. */
export function normalizePairingCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/\D/g, "");
  return digits.length === PAIRING_CODE_LENGTH ? digits : null;
}

export function pairingExpiresAt(now: Date, ttlSeconds: number = PAIRING_CODE_TTL_SECONDS): string {
  return new Date(now.getTime() + ttlSeconds * 1000).toISOString();
}

export function derivePairingStatus(row: PairingCodeRow, now: Date): PairingCodeStatus {
  if (row.used_at) return "used";
  return Date.parse(row.expires_at) > now.getTime() ? "active" : "expired";
}

/** Kalan saniye (negatif olmaz). */
export function pairingSecondsRemaining(expiresAt: string, now: Date): number {
  const remaining = Math.floor((Date.parse(expiresAt) - now.getTime()) / 1000);
  return remaining > 0 ? remaining : 0;
}

/**
 * Platformu önce açık payload alanından, yoksa User-Agent'tan çıkarır.
 * Capacitor WebView'leri iOS'ta "iPhone/iPad", Android'de "Android" içerir.
 */
export function resolvePlatform(explicit: unknown, userAgent: string | null): "ios" | "android" | null {
  if (typeof explicit === "string") {
    const value = explicit.trim().toLowerCase();
    if (value === "ios" || value === "android") return value;
  }
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return null;
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "ios";
  return null;
}

export function isSessionActive(row: Pick<MobileSessionRow, "expires_at" | "revoked_at">, now: Date): boolean {
  if (row.revoked_at) return false;
  return Date.parse(row.expires_at) > now.getTime();
}

export function toDeviceView(row: MobileSessionRow, now: Date): MobileDeviceView {
  const platform = row.platform === "ios" || row.platform === "android" ? row.platform : "bilinmiyor";
  return {
    id: row.id,
    deviceLabel: row.device_label?.trim() || "İsimsiz cihaz",
    platform,
    appVersion: row.app_version,
    appBuild: row.app_build,
    pairedAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    active: isSessionActive(row, now),
    revokedAt: row.revoked_at,
  };
}

/** Kısa metin: "2 saat önce", "3 gün önce" gibi. */
export function relativeTimeTr(iso: string | null, now: Date): string {
  if (!iso) return "hiç";
  const diffSeconds = Math.floor((now.getTime() - Date.parse(iso)) / 1000);
  if (!Number.isFinite(diffSeconds)) return "bilinmiyor";
  if (diffSeconds < 60) return "az önce";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} dk önce`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} saat önce`;
  return `${Math.floor(diffSeconds / 86400)} gün önce`;
}
