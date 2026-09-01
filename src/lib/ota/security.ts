import type { OtaPlatform } from "./types";

interface AllowlistEntry {
  hosts: string[];
  pathPattern: RegExp;
}

// Airbnb: kullanıcı production'da gerçek export URL'siyle doğruladı - host tam olarak
// www.airbnb.com, path yalnız /calendar/ical/<rakamsal-listing-id>.ics. Secret export token query
// string'de (?s=...) taşınır - yalnız host/path kontrol edilir, query hiç karşılaştırılmaz/loglanmaz.
// www.airbnb.com.tr gibi başka host'lar gerçek örnek doğrulanmadan BİLEREK eklenmedi.
//
// Booking.com: kullanıcı production'da gerçek export URL'siyle doğruladı - host tam olarak
// ical.booking.com, path /v1/export ailesi (secret token query string'de). admin.booking.com,
// www.booking.com gibi diğer Booking host'ları BİLEREK allowlist'e alınmadı - yalnız gözlenen
// export host'u.
const ALLOWLIST: Record<OtaPlatform, AllowlistEntry> = {
  airbnb: { hosts: ["www.airbnb.com"], pathPattern: /^\/calendar\/ical\/[0-9]+\.ics$/ },
  booking: { hosts: ["ical.booking.com"], pathPattern: /^\/v1\/export\/?$/ },
};

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 512 * 1024;

// Savunma derinliği katmanı: Cloudflare Workers'ın kendi ağ katmanı zaten RFC1918/loopback/
// link-local hedeflere outbound fetch'i platform seviyesinde engeller - host/path allowlist'i
// birincil kontrolümüz, bu desen kontrolü ek bir katman.
const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /\.internal$/i,
  /^metadata\.google\.internal$/i,
];

function isBlockedHostname(hostname: string): boolean {
  return PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

function isAllowed(url: URL, platform: OtaPlatform): boolean {
  if (url.protocol !== "https:") return false;
  if (isBlockedHostname(url.hostname)) return false;
  const entry = ALLOWLIST[platform];
  if (!entry.hosts.includes(url.hostname.toLowerCase())) return false;
  return entry.pathPattern.test(url.pathname);
}

export function hasAllowlistedHosts(platform: OtaPlatform): boolean {
  return ALLOWLIST[platform].hosts.length > 0;
}

export class SsrfBlockedError extends Error {}

export async function fetchIcsSafely(rawUrl: string, platform: OtaPlatform): Promise<string> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("URL biçimi geçersiz.");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isAllowed(current, platform)) {
      // Kasıtlı olarak host/path/token içermez - bkz. verify.ts'teki platforma özel kullanıcı mesajı.
      throw new SsrfBlockedError("Desteklenmeyen host veya path.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "SafiraDestanVillas-CalendarSync/1.0" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect location eksik.");
      current = new URL(location, current);
      continue;
    }

    if (!response.ok) {
      throw new Error(`ICS fetch başarısız: HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return await response.text();

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BODY_BYTES) {
          await reader.cancel();
          throw new Error("ICS yanıtı beklenenden büyük.");
        }
        chunks.push(value);
      }
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(merged);
  }

  throw new Error("Çok fazla redirect.");
}

// Hata mesajlarını D1/audit_log'a yazmadan önce URL query-string'lerini (secret token taşıyabilir)
// temizler.
export function sanitizeErrorMessage(message: string): string {
  return message.replace(/(https?:\/\/[^\s?]+)\?[^\s]*/gi, "$1?[redacted]").slice(0, 500);
}
