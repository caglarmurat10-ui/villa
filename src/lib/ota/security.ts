import type { OtaPlatform } from "./types";

interface AllowlistEntry {
  hosts: string[];
  pathPattern: RegExp;
}

// Airbnb: kullanıcı production'da iki gerçek export URL'siyle doğruladı - host tam olarak
// www.airbnb.com VEYA www.airbnb.com.tr (Türkiye Airbnb export linki bu host'u kullanıyor), her
// ikisi için de aynı sıkı path: /calendar/ical/<rakamsal-listing-id>.ics. Secret export token query
// string'de (?s=...) taşınır - yalnız host/path kontrol edilir, query hiç karşılaştırılmaz/loglanmaz.
// Wildcard (*.airbnb.com / *.airbnb.com.tr) BİLEREK kullanılmadı - yalnız bu iki exact host.
//
// Booking.com: kullanıcı production'da gerçek export URL'siyle doğruladı - host tam olarak
// ical.booking.com, path /v1/export ailesi (secret token query string'de). admin.booking.com,
// www.booking.com gibi diğer Booking host'ları BİLEREK allowlist'e alınmadı - yalnız gözlenen
// export host'u.
const ALLOWLIST: Record<OtaPlatform, AllowlistEntry> = {
  airbnb: { hosts: ["www.airbnb.com", "www.airbnb.com.tr"], pathPattern: /^\/calendar\/ical\/[0-9]+\.ics$/ },
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

// ============ Aşamalı doğrulama teşhisi (yalnız /api/ota/connections/verify için) ============
// fetchIcsSafely() YUKARIDA DEĞİŞMEDİ (sync.ts + connect route hâlâ onu kullanıyor - Booking'in
// zaten çalışan bağlantılarına sıfır davranış riski). Bu bölüm, Airbnb doğrulaması production'da
// gerçek URL ile başarısız olduğunda HANGİ AŞAMADA başarısız olduğunu güvenli biçimde görebilmek
// için ayrı, yalnızca verify.ts'in kullandığı bir kopyadır.
export type OtaVerifyStage =
  | "url-parse"
  | "initial-url-validation"
  | "dns-ip-validation"
  | "fetch"
  | "redirect-validation"
  | "http-status"
  | "response-size"
  | "ics-content-validation"
  | "ics-parse";

export class StagedFetchError extends Error {
  stage: OtaVerifyStage;
  constructor(stage: OtaVerifyStage, message: string) {
    super(message);
    this.name = "StagedFetchError";
    this.stage = stage;
  }
}

// Yalnız secret İÇERMEYEN metadata loglar: stage adı, HTTP status, redirect hostname (path/query
// asla), content-type. Cloudflare `wrangler tail` ile canlı izlenebilir - D1'e yazılmaz.
function logStage(platform: OtaPlatform, stage: OtaVerifyStage, meta: Record<string, string | number> = {}) {
  console.log(`[OTA verify] platform=${platform} stage=${stage}`, meta);
}

function matchesAllowlist(url: URL, platform: OtaPlatform): boolean {
  const entry = ALLOWLIST[platform];
  return entry.hosts.includes(url.hostname.toLowerCase()) && entry.pathPattern.test(url.pathname);
}

export async function fetchIcsSafelyStaged(rawUrl: string, platform: OtaPlatform): Promise<string> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    logStage(platform, "url-parse");
    throw new StagedFetchError("url-parse", "URL biçimi geçersiz.");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const stage: OtaVerifyStage = hop === 0 ? "initial-url-validation" : "redirect-validation";

    if (current.protocol !== "https:") {
      logStage(platform, stage, { protocol: current.protocol });
      throw new StagedFetchError(stage, "Desteklenmeyen host veya path.");
    }
    if (!matchesAllowlist(current, platform)) {
      logStage(platform, stage, hop === 0 ? { hostname: current.hostname } : { redirectHostname: current.hostname });
      throw new StagedFetchError(stage, "Desteklenmeyen host veya path.");
    }
    if (isBlockedHostname(current.hostname)) {
      logStage(platform, "dns-ip-validation", { hostname: current.hostname });
      throw new StagedFetchError("dns-ip-validation", "Desteklenmeyen host veya path.");
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
    } catch (error) {
      logStage(platform, "fetch", { errorName: error instanceof Error ? error.name : "unknown" });
      throw new StagedFetchError("fetch", "Bağlantı kurulamadı.");
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        logStage(platform, "redirect-validation", { status: response.status });
        throw new StagedFetchError("redirect-validation", "Yönlendirme hedefi eksik.");
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        logStage(platform, "redirect-validation", { status: response.status });
        throw new StagedFetchError("redirect-validation", "Yönlendirme hedefi geçersiz.");
      }
      logStage(platform, "redirect-validation", { status: response.status, redirectHostname: next.hostname });
      current = next;
      continue;
    }

    if (!response.ok) {
      logStage(platform, "http-status", { status: response.status });
      throw new StagedFetchError("http-status", "Takvim sağlayıcısından beklenmeyen yanıt.");
    }
    logStage(platform, "http-status", { status: response.status, contentType: response.headers.get("content-type") ?? "unknown" });

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
          logStage(platform, "response-size", { bytes: total });
          throw new StagedFetchError("response-size", "Takvim yanıtı beklenenden büyük.");
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

  logStage(platform, "redirect-validation", { reason: "too-many-redirects" });
  throw new StagedFetchError("redirect-validation", "Çok fazla yönlendirme.");
}
