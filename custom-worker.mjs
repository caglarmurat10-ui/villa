import nextWorker from "./.open-next/worker.js";

const DEFAULT_PUBLISH_TIME = "12:00";
const DEFAULT_LIMIT = 2;
const MAX_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 30 * 60 * 1000;
const PUBLIC_HOSTS = new Set(["safiradestan.com", "www.safiradestan.com"]);
const ADMIN_HOST = "admin.safiradestan.com";
const ADMIN_ORIGIN = `https://${ADMIN_HOST}`;
const LEGACY_ADMIN_ENTRY_PATHS = new Set(["/", "/login"]);
const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/system/version",
  "/api/public/booking-inquiries",
  "/api/weather/ingest",
  "/api/weather/current",
  "/api/payments/checkout",
  "/api/payments/paytr/callback",
]);
// Dinamik token segmenti taşıyan public API yolları (Set ile tam eşleşmiyor, prefix ile kontrol
// edilir) - şu an yalnız OTA export feed'i: /api/calendar/export/<opaque-token>.ics
const PUBLIC_API_PATH_PREFIXES = ["/api/calendar/export/"];
// /rehber alt sayfaları - src/lib/region-guide-pages.ts'teki REGION_GUIDE_PAGE_SLUGS ve
// src/middleware.ts'teki REGION_GUIDE_SLUGS ile birebir aynı kalmalı (üç bağımsız kopya - custom-worker.mjs
// Next.js "@/" alias'larını çözemediği için middleware.ts'i import edemez, bkz. dosyanın başındaki
// genel NOT).
const REGION_GUIDE_SLUGS = ["patara", "patara-plaji", "patara-antik-kenti", "kas", "kalkan"];
const PUBLIC_ROUTE_MAP = new Map([
  ["/", "/site"],
  ["/villa-safira", "/site/villa-safira"],
  ["/villa-destan", "/site/villa-destan"],
  ["/rezervasyon-kosullari", "/site/rezervasyon-kosullari"],
  ["/rehber", "/site/rehber"],
  ...REGION_GUIDE_SLUGS.map((slug) => [`/rehber/${slug}`, `/site/rehber/${slug}`]),
]);
// /odeme/[paymentId](/basarili|/basarisiz) - src/app/odeme/... altında zaten gerçek route, rewrite
// gerekmez, yalnız geçişe izin verilir (PayTR checkout/callback sayfaları - dinamik segment).
const PUBLIC_PASSTHROUGH_PREFIXES = ["/odeme/"];
const TRANSITION_PATHS = new Set([
  "/api/health",
  "/api/system/version",
  "/api/meta/instagram/callback",
  "/api/meta/facebook/callback",
]);

const ADMIN_LOGIN_PATH = "/login";
const ADMIN_LOGIN_API = "/api/auth/login";
const ADMIN_LOGOUT_API = "/api/auth/logout";
const ADMIN_CHANGE_PASSWORD_API = "/api/auth/change-password";
const ADMIN_PUBLIC_PATHS = new Set([
  ADMIN_LOGIN_PATH,
  "/api/health",
  "/api/system/version",
  "/api/meta/instagram/callback",
  "/api/meta/facebook/callback",
]);
const ADMIN_SESSION_COOKIE = "__Host-villa_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60;
// Mobil (Capacitor Android/iOS) bearer-token oturumu - web'in cookie oturumundan bağımsız, aynı
// ADMIN_PASSWORD credential'ını doğrular. Web'den çok daha uzun TTL (270 gün, 180-365 aralığında)
// - mobil artık trusted-device pairing ile eşleşiyor, günlük kullanımda yeniden eşleştirme
// istenmiyor; biyometrik kilit zaten cihaz üzerindeki ikinci katman, server her zaman revoke edebilir.
const MOBILE_SESSION_TTL_SECONDS = 270 * 24 * 60 * 60;
const MOBILE_LOGIN_API = "/api/mobile/v1/auth/login";
const MOBILE_LOGOUT_API = "/api/mobile/v1/auth/logout";
// Eşleştirme kodu: 10 dakika geçerli, tek kullanımlık, yalnız SHA-256 hash D1'de tutulur
// (bkz. migrations/0017_mobile_pairing_codes.sql, src/app/api/admin/mobile-pairing/route.ts).
// Kod üretimi admin cookie auth'u ile korunan o route'ta yapılır - bu dosya yalnız tüketim
// (pairing) tarafını yönetir.
const MOBILE_PAIR_API = "/api/mobile/v1/auth/pair";
// Capacitor'ın varsayılan WebView origin'leri (Android: https://localhost, iOS: capacitor://localhost)
// + yerel geliştirme. "*" KULLANILMIYOR - yalnız bu tam eşleşen origin'lere CORS izni verilir.
const MOBILE_ALLOWED_ORIGINS = new Set([
  "https://localhost",
  "capacitor://localhost",
  "http://localhost",
]);
const ADMIN_MIN_PASSWORD_LENGTH = 12;
const ADMIN_MIN_SESSION_SECRET_LENGTH = 32;
const ADMIN_MIN_NEW_PASSWORD_LENGTH = 14;
const ADMIN_MAX_NEW_PASSWORD_LENGTH = 256;
// Cloudflare Workers' WebCrypto PBKDF2 implementation rejects iteration counts above 100000
// (NotSupportedError at runtime) even though it silently succeeds in local wrangler dev/preview.
// 100000 is the platform ceiling, so it's used here rather than a higher "ideal" value.
const ADMIN_PBKDF2_ITERATIONS = 100000;
const ADMIN_PBKDF2_HASH_BITS = 256;
const ADMIN_BOOTSTRAP_CREDENTIAL_VERSION = 0;
const ADMIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_RATE_LIMIT_MAX_FAILURES = 5;
const ADMIN_RATE_LIMIT_DELAY_MS = 350;
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function safeTime(value) {
  const normalized = String(value ?? "").trim();
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : DEFAULT_PUBLISH_TIME;
}

function safeLimit(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(4, parsed)) : DEFAULT_LIMIT;
}

function istanbulClock(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

function safeCronError(value) {
  const message = value instanceof Error ? value.message : String(value ?? "Bilinmeyen hata");
  return message
    .replace(
      /(access_token|client_secret|authorization_code|short_lived_token|long_lived_token|code|fb_exchange_token)=([^&\s]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
    .slice(0, 320);
}

function publicAssetPath(pathname) {
  return pathname.startsWith("/_next/") ||
    pathname.startsWith("/villas/") ||
    pathname === "/app-icon.svg" ||
    pathname === "/app-icon-192.png" ||
    pathname === "/app-icon-512.png" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest";
}

function adminPublicAssetPath(pathname) {
  return publicAssetPath(pathname) || pathname === "/manifest.webmanifest";
}

function routeRequest(request) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  if (host === "www.safiradestan.com") {
    url.hostname = "safiradestan.com";
    return { response: Response.redirect(url.toString(), 308) };
  }

  if (PUBLIC_HOSTS.has(host)) {
    if (url.pathname.startsWith("/api/")) {
      const allowed = PUBLIC_API_PATHS.has(url.pathname) || PUBLIC_API_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
      return allowed
        ? { request }
        : { response: new Response("Not Found", { status: 404 }) };
    }

    if (publicAssetPath(url.pathname)) return { request };

    if (PUBLIC_PASSTHROUGH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return { request };

    const target = PUBLIC_ROUTE_MAP.get(url.pathname);
    if (!target) return { response: new Response("Not Found", { status: 404 }) };

    url.pathname = target;
    return { request: new Request(url.toString(), request) };
  }

  if (host === ADMIN_HOST) return { request };

  if (host.endsWith(".workers.dev")) {
    // routeRequest() adminAuthGate'ten SONRA ama nextWorker.fetch()'ten (dolayısıyla
    // middleware.ts'ten) ÖNCE çalışıyor - middleware.ts'teki WORKER_ALLOWED_PATHS muafiyeti tek
    // başına yetmiyor, burada da aynı path'in geçmesine izin vermek gerekiyor.
    if (url.pathname.startsWith("/api/media/drive/")) return { request };
    if (LEGACY_ADMIN_ENTRY_PATHS.has(url.pathname)) {
      const destination = new URL(`${url.pathname}${url.search}`, ADMIN_ORIGIN);
      return { response: Response.redirect(destination.toString(), 308) };
    }
    return { response: new Response("Not Found", { status: 404 }) };
  }

  if (TRANSITION_PATHS.has(url.pathname)) return { request };

  return { response: new Response("Not Found", { status: 404 }) };
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      ...headers,
    },
  });
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmacKey(secret, usages) {
  return crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

async function createAdminSession(secret, credentialVersion) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(TEXT_ENCODER.encode(JSON.stringify({
    v: 1,
    iat: now,
    exp: now + ADMIN_SESSION_TTL_SECONDS,
    cv: credentialVersion,
  })));
  const key = await hmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, TEXT_ENCODER.encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function cookieValue(request, name) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return part.slice(separator + 1).trim();
  }
  return "";
}

async function verifyAdminSession(request, env) {
  const secret = env.ADMIN_SESSION_SECRET;
  if (typeof secret !== "string" || secret.length < ADMIN_MIN_SESSION_SECRET_LENGTH) return false;
  const token = cookieValue(request, ADMIN_SESSION_COOKIE);
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;

  try {
    const key = await hmacKey(secret, ["verify"]);
    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signature),
      TEXT_ENCODER.encode(payload),
    );
    if (!verified) return false;

    const data = JSON.parse(TEXT_DECODER.decode(base64UrlDecode(payload)));
    const now = Math.floor(Date.now() / 1000);
    const structurallyValid = data?.v === 1 &&
      Number.isInteger(data.iat) &&
      Number.isInteger(data.exp) &&
      data.iat <= now + 60 &&
      data.exp > now &&
      Number.isInteger(data.cv);
    if (!structurallyValid) return false;

    const credential = await getAdminCredential(env);
    return data.cv === credential.credentialVersion;
  } catch {
    return false;
  }
}

async function safePasswordMatch(provided, expected) {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(provided)),
    crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function constantTimeBytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function pbkdf2DeriveBits(password, saltBytes, iterations) {
  const keyMaterial = await crypto.subtle.importKey("raw", TEXT_ENCODER.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
    keyMaterial,
    ADMIN_PBKDF2_HASH_BITS,
  );
  return new Uint8Array(derived);
}

async function hashNewPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2DeriveBits(password, salt, ADMIN_PBKDF2_ITERATIONS);
  return {
    hash: base64UrlEncode(hash),
    salt: base64UrlEncode(salt),
    iterations: ADMIN_PBKDF2_ITERATIONS,
  };
}

async function verifyPasswordAgainstHash(password, saltB64, hashB64, iterations) {
  try {
    const salt = base64UrlDecode(saltB64);
    const expected = base64UrlDecode(hashB64);
    const computed = await pbkdf2DeriveBits(password, salt, iterations);
    return constantTimeBytesEqual(computed, expected);
  } catch {
    return false;
  }
}

function adminAuthConfigured(env) {
  return typeof env.ADMIN_PASSWORD === "string" &&
    env.ADMIN_PASSWORD.length >= ADMIN_MIN_PASSWORD_LENGTH &&
    typeof env.ADMIN_SESSION_SECRET === "string" &&
    env.ADMIN_SESSION_SECRET.length >= ADMIN_MIN_SESSION_SECRET_LENGTH;
}

async function getAdminCredential(env) {
  const row = await env.DB.prepare(
    "SELECT password_hash, password_salt, password_iterations, credential_version FROM admin_auth_state WHERE id = 1",
  ).first();

  if (row) {
    return {
      kind: "d1",
      credentialVersion: row.credential_version,
      verify: (password) => verifyPasswordAgainstHash(password, row.password_salt, row.password_hash, row.password_iterations),
    };
  }

  return {
    kind: "bootstrap",
    credentialVersion: ADMIN_BOOTSTRAP_CREDENTIAL_VERSION,
    verify: (password) => safePasswordMatch(password, env.ADMIN_PASSWORD),
  };
}

function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

async function isAuthRateLimited(env, ip, scope) {
  const since = new Date(Date.now() - ADMIN_RATE_LIMIT_WINDOW_MS).toISOString();
  const row = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM audit_log WHERE entity_id = ? AND action = ? AND created_at >= ?",
  ).bind(ip, `${scope}_FAILED`, since).first();
  return (row?.cnt ?? 0) >= ADMIN_RATE_LIMIT_MAX_FAILURES;
}

async function recordAuthFailure(env, ip, scope) {
  await env.DB.prepare(
    "INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, ?, '{}', ?)",
  ).bind(ip, `${scope}_FAILED`, new Date().toISOString()).run();
}

function authDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleAdminLogin(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405, { Allow: "POST" });
  }
  if (!adminAuthConfigured(env)) {
    console.error("[Admin Auth] Required secrets are missing or too short.");
    return jsonResponse({ error: "Yönetim girişi geçici olarak kullanılamıyor." }, 503);
  }

  try {
    const ip = clientIp(request);
    if (await isAuthRateLimited(env, ip, "LOGIN")) {
      return jsonResponse({ error: "Çok fazla başarısız deneme. Lütfen birkaç dakika sonra tekrar deneyin." }, 429);
    }

    const payload = await request.json().catch(() => null);
    const password = typeof payload?.password === "string" ? payload.password : "";
    if (password.length < ADMIN_MIN_PASSWORD_LENGTH || password.length > 256) {
      await recordAuthFailure(env, ip, "LOGIN");
      await authDelay(ADMIN_RATE_LIMIT_DELAY_MS);
      return jsonResponse({ error: "Parola hatalı." }, 401);
    }

    const credential = await getAdminCredential(env);
    const matches = await credential.verify(password);
    if (!matches) {
      await recordAuthFailure(env, ip, "LOGIN");
      await authDelay(ADMIN_RATE_LIMIT_DELAY_MS);
      return jsonResponse({ error: "Parola hatalı." }, 401);
    }

    const session = await createAdminSession(env.ADMIN_SESSION_SECRET, credential.credentialVersion);
    return jsonResponse(
      { ok: true, expiresIn: ADMIN_SESSION_TTL_SECONDS },
      200,
      {
        "Set-Cookie": `${ADMIN_SESSION_COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
      },
    );
  } catch (error) {
    console.error(`[Admin Auth] login failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return jsonResponse({ error: "Giriş yapılamadı. Lütfen tekrar deneyin." }, 500);
  }
}

function handleAdminLogout(request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405, { Allow: "POST" });
  }
  return jsonResponse(
    { ok: true },
    200,
    {
      "Set-Cookie": `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  );
}

function isAllowedAdminOrigin(request) {
  const origin = request.headers.get("origin");
  return origin === ADMIN_ORIGIN;
}

async function handleChangePassword(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405, { Allow: "POST" });
  }
  if (!isAllowedAdminOrigin(request)) {
    return jsonResponse({ error: "Geçersiz istek kaynağı." }, 403);
  }
  if (!adminAuthConfigured(env)) {
    console.error("[Admin Auth] Required secrets are missing or too short.");
    return jsonResponse({ error: "Yönetim girişi geçici olarak kullanılamıyor." }, 503);
  }

  try {
    const authenticated = await verifyAdminSession(request, env);
    if (!authenticated) {
      return jsonResponse({ error: "Yönetim oturumu gerekli." }, 401);
    }

    const ip = clientIp(request);
    if (await isAuthRateLimited(env, ip, "CHANGE_PASSWORD")) {
      return jsonResponse({ error: "Çok fazla deneme. Lütfen birkaç dakika sonra tekrar deneyin." }, 429);
    }

    const payload = await request.json().catch(() => null);
    const currentPassword = typeof payload?.currentPassword === "string" ? payload.currentPassword : "";
    const newPassword = typeof payload?.newPassword === "string" ? payload.newPassword : "";

    const credential = await getAdminCredential(env);
    const currentValid = currentPassword.length > 0 && await credential.verify(currentPassword);
    if (!currentValid) {
      await recordAuthFailure(env, ip, "CHANGE_PASSWORD");
      await authDelay(ADMIN_RATE_LIMIT_DELAY_MS);
      return jsonResponse({ error: "Mevcut parola hatalı." }, 401);
    }

    if (newPassword.length < ADMIN_MIN_NEW_PASSWORD_LENGTH || newPassword.length > ADMIN_MAX_NEW_PASSWORD_LENGTH) {
      return jsonResponse({ error: `Yeni parola ${ADMIN_MIN_NEW_PASSWORD_LENGTH}-${ADMIN_MAX_NEW_PASSWORD_LENGTH} karakter arasında olmalı.` }, 400);
    }

    if (await credential.verify(newPassword)) {
      return jsonResponse({ error: "Yeni parola mevcut parolayla aynı olamaz." }, 400);
    }

    const { hash, salt, iterations } = await hashNewPassword(newPassword);
    const now = new Date().toISOString();
    const nextVersion = credential.credentialVersion + 1;

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO admin_auth_state (id, password_hash, password_salt, password_iterations, credential_version, updated_at)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          password_hash = excluded.password_hash,
          password_salt = excluded.password_salt,
          password_iterations = excluded.password_iterations,
          credential_version = excluded.credential_version,
          updated_at = excluded.updated_at`)
        .bind(hash, salt, iterations, nextVersion, now),
      env.DB.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES ('admin', 'ADMIN_PASSWORD_CHANGED', ?, ?)")
        .bind(JSON.stringify({ credentialVersion: nextVersion }), now),
    ]);

    const session = await createAdminSession(env.ADMIN_SESSION_SECRET, nextVersion);
    return jsonResponse(
      { ok: true },
      200,
      {
        "Set-Cookie": `${ADMIN_SESSION_COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
      },
    );
  } catch (error) {
    console.error(`[Admin Auth] change-password failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return jsonResponse({ error: "Parola değiştirilemedi. Lütfen tekrar deneyin." }, 500);
  }
}

async function adminAuthGate(request, env) {
  const url = new URL(request.url);
  if (url.hostname.toLowerCase() !== ADMIN_HOST) return null;

  if (url.pathname === ADMIN_LOGIN_API) return handleAdminLogin(request, env);
  if (url.pathname === ADMIN_LOGOUT_API) return handleAdminLogout(request);
  if (url.pathname === ADMIN_CHANGE_PASSWORD_API) return handleChangePassword(request, env);
  // /api/media/drive/[fileId]: Meta'nın Graph API'si Instagram/Facebook medya container'ı
  // oluştururken bu URL'yi KENDİ SUNUCULARINDAN, oturum çerezi olmadan indiriyor - admin oturumu
  // gerektirmemeli. Route'un kendisi kapalı bir allowlist'ten (resolveDriveMediaById, sabit 21
  // gerçek villa dosyası) besleniyor, keyfi URL'e fetch yapmıyor - herkese açık olması güvenli.
  // Bu satır olmadan Meta 401/JSON hatası alıyor ve "medya container oluşturulamadı (9004)" ile
  // reddediyor - dosyanın kendisinde hiçbir sorun yok, erişilemez olması sorunun tamamı.
  if (adminPublicAssetPath(url.pathname) || url.pathname.startsWith("/api/media/drive/") || ADMIN_PUBLIC_PATHS.has(url.pathname)) return null;

  const authenticated = await verifyAdminSession(request, env);
  if (url.pathname === ADMIN_LOGIN_PATH) {
    return authenticated ? Response.redirect(new URL("/", url).toString(), 303) : null;
  }
  if (authenticated) return null;

  if (url.pathname.startsWith("/api/")) {
    return jsonResponse({ error: "Yönetim oturumu gerekli." }, 401);
  }

  const loginUrl = new URL(ADMIN_LOGIN_PATH, url);
  const next = `${url.pathname}${url.search}`;
  if (next !== "/") loginUrl.searchParams.set("next", next);
  return Response.redirect(loginUrl.toString(), 303);
}

// ============ Mobil (Capacitor) bearer-token auth ============

function mobileCorsHeaders(request) {
  const origin = request.headers.get("origin") ?? "";
  if (!MOBILE_ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function withMobileCors(response, request) {
  const cors = mobileCorsHeaders(request);
  if (Object.keys(cors).length === 0) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", TEXT_ENCODER.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bearerToken(request) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function verifyMobileBearer(request, env) {
  const token = bearerToken(request);
  if (!token || token.length < 32) return false;
  try {
    const tokenHash = await sha256Hex(token);
    const now = new Date().toISOString();
    const row = await env.DB.prepare(
      "SELECT id, credential_version FROM mobile_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?",
    ).bind(tokenHash, now).first();
    if (!row) return false;

    const credential = await getAdminCredential(env);
    if (row.credential_version !== credential.credentialVersion) return false;

    // last_seen_at güncellemesi cevabı bloklamaz - "en iyi çaba" (best-effort), başarısız olursa
    // auth sonucunu etkilemez.
    env.DB.prepare("UPDATE mobile_sessions SET last_seen_at = ? WHERE id = ?").bind(now, row.id).run().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

async function handleMobileLogin(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405, { Allow: "POST" });
  }
  if (!adminAuthConfigured(env)) {
    console.error("[Mobile Auth] Required secrets are missing or too short.");
    return jsonResponse({ error: "Giriş şu anda kullanılamıyor." }, 503);
  }

  try {
    const ip = clientIp(request);
    if (await isAuthRateLimited(env, ip, "MOBILE_LOGIN")) {
      return jsonResponse({ error: "Çok fazla başarısız deneme. Lütfen birkaç dakika sonra tekrar deneyin." }, 429);
    }

    const payload = await request.json().catch(() => null);
    const password = typeof payload?.password === "string" ? payload.password : "";
    const deviceLabel = typeof payload?.deviceLabel === "string" ? payload.deviceLabel.slice(0, 80) : null;
    if (password.length < ADMIN_MIN_PASSWORD_LENGTH || password.length > 256) {
      await recordAuthFailure(env, ip, "MOBILE_LOGIN");
      await authDelay(ADMIN_RATE_LIMIT_DELAY_MS);
      return jsonResponse({ error: "Parola hatalı." }, 401);
    }

    const credential = await getAdminCredential(env);
    const matches = await credential.verify(password);
    if (!matches) {
      await recordAuthFailure(env, ip, "MOBILE_LOGIN");
      await authDelay(ADMIN_RATE_LIMIT_DELAY_MS);
      return jsonResponse({ error: "Parola hatalı." }, 401);
    }

    const rawToken = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
    const tokenHash = await sha256Hex(rawToken);
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + MOBILE_SESSION_TTL_SECONDS * 1000).toISOString();
    const id = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO mobile_sessions (id, token_hash, credential_version, device_label, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, tokenHash, credential.credentialVersion, deviceLabel, nowIso, expiresAt, nowIso).run();

    return jsonResponse({ ok: true, token: rawToken, expiresIn: MOBILE_SESSION_TTL_SECONDS });
  } catch (error) {
    console.error(`[Mobile Auth] login failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return jsonResponse({ error: "Giriş yapılamadı. Lütfen tekrar deneyin." }, 500);
  }
}

// Şifresiz cihaz eşleştirme: kullanıcı admin panelinden ürettiği tek kullanımlık 6 haneli kodu
// bir kez girer, karşılığında normal login ile birebir aynı opaque mobile_sessions token'ı alır.
// ADMIN_PASSWORD'a hiç ihtiyaç yok - kodun kendisi zaten admin oturumu doğrulanmış bir kullanıcı
// tarafından üretildiği için credential'ın yerini alıyor.
async function handleMobilePair(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405, { Allow: "POST" });
  }
  try {
    const ip = clientIp(request);
    if (await isAuthRateLimited(env, ip, "MOBILE_PAIR")) {
      return jsonResponse({ error: "Çok fazla başarısız deneme. Lütfen birkaç dakika sonra tekrar deneyin." }, 429);
    }

    const payload = await request.json().catch(() => null);
    const code = typeof payload?.code === "string" ? payload.code.replace(/\D/g, "") : "";
    const deviceLabel = typeof payload?.deviceLabel === "string" ? payload.deviceLabel.slice(0, 80) : null;
    if (code.length !== 6) {
      await recordAuthFailure(env, ip, "MOBILE_PAIR");
      await authDelay(ADMIN_RATE_LIMIT_DELAY_MS);
      return jsonResponse({ error: "Geçersiz kod." }, 401);
    }

    const codeHash = await sha256Hex(code);
    const now = new Date();
    const nowIso = now.toISOString();
    const row = await env.DB.prepare(
      "SELECT id FROM mobile_pairing_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?",
    ).bind(codeHash, nowIso).first();

    if (!row) {
      await recordAuthFailure(env, ip, "MOBILE_PAIR");
      await authDelay(ADMIN_RATE_LIMIT_DELAY_MS);
      return jsonResponse({ error: "Kod geçersiz veya süresi dolmuş." }, 401);
    }

    // Tek kullanımlık: eşleştirme başarılı olsa da olmasa da bu kod satırı artık tekrar
    // kullanılamaz hale getirilir (used_at set) - başarısız devam eden akış bile kodu tüketir.
    await env.DB.prepare("UPDATE mobile_pairing_codes SET used_at = ? WHERE id = ?").bind(nowIso, row.id).run();

    const credential = await getAdminCredential(env);
    const rawToken = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(now.getTime() + MOBILE_SESSION_TTL_SECONDS * 1000).toISOString();
    const sessionId = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO mobile_sessions (id, token_hash, credential_version, device_label, created_at, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(sessionId, tokenHash, credential.credentialVersion, deviceLabel, nowIso, expiresAt, nowIso).run();

    return jsonResponse({ ok: true, token: rawToken, expiresIn: MOBILE_SESSION_TTL_SECONDS });
  } catch (error) {
    console.error(`[Mobile Auth] pair failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return jsonResponse({ error: "Eşleştirme başarısız. Lütfen tekrar deneyin." }, 500);
  }
}

async function handleMobileLogout(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405, { Allow: "POST" });
  }
  const token = bearerToken(request);
  if (token) {
    try {
      const tokenHash = await sha256Hex(token);
      await env.DB.prepare("UPDATE mobile_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
        .bind(new Date().toISOString(), tokenHash).run();
    } catch (error) {
      console.error(`[Mobile Auth] logout failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  return jsonResponse({ ok: true });
}

async function mobileAuthGate(request, env) {
  const url = new URL(request.url);
  if (url.hostname.toLowerCase() !== ADMIN_HOST) return null;
  if (!url.pathname.startsWith("/api/mobile/v1/")) return null;

  if (request.method === "OPTIONS") {
    return withMobileCors(new Response(null, { status: 204 }), request);
  }
  if (url.pathname === MOBILE_LOGIN_API) {
    return withMobileCors(await handleMobileLogin(request, env), request);
  }
  if (url.pathname === MOBILE_PAIR_API) {
    return withMobileCors(await handleMobilePair(request, env), request);
  }
  if (url.pathname === "/api/mobile/v1/health") {
    // Auth öncesi bağlantı kontrolü için bilerek public - hiçbir hassas veri döndürmez.
    return withMobileCors(jsonResponse({ ok: true, service: "villa-yonetim" }), request);
  }
  if (url.pathname === MOBILE_LOGOUT_API) {
    const authenticated = await verifyMobileBearer(request, env);
    if (!authenticated) return withMobileCors(jsonResponse({ error: "Oturum gerekli." }, 401), request);
    return withMobileCors(await handleMobileLogout(request, env), request);
  }

  const authenticated = await verifyMobileBearer(request, env);
  if (!authenticated) {
    return withMobileCors(jsonResponse({ error: "Oturum gerekli veya süresi dolmuş." }, 401), request);
  }
  return null;
}

async function duePosts(env, scheduledAt) {
  const clock = istanbulClock(scheduledAt);
  const publishTime = safeTime(env.SOCIAL_AUTO_PUBLISH_TIME);
  const limit = safeLimit(env.SOCIAL_AUTO_PUBLISH_LIMIT);
  const cooldownBefore = new Date(scheduledAt.getTime() - RETRY_COOLDOWN_MS).toISOString();
  // HARD GATE: Destan Instagram'ın Business Portfolio ownership sorunu çözülene kadar cron bu
  // satırları seçemez - Graph API'ye hiçbir istek gitmeden burada eleniyor. DB'de connected
  // görünmesi (social_accounts satırı, token_expires_at) bu gate'i etkilemez; yalnız villa+platform
  // kombinasyonuna bakılır. Manuel "Şimdi yayınla" için aynı gate /api/meta/instagram/publish
  // route'unda ayrıca uygulanıyor (iki bağımsız katman - src/lib/social-availability.ts değil, bu
  // tamamen ayrı bir iş kuralı).
  const commonFilter = `status = 'Planlandı'
      AND approval_status = 'Onaylandı'
      AND platform IN ('Instagram', 'Facebook')
      AND NOT (villa = 'Destan' AND platform = 'Instagram')
      AND (
        (platform = 'Instagram' AND content_type IN ('Gönderi', 'Hikâye', 'Reels'))
        OR (platform = 'Facebook' AND content_type IN ('Gönderi', 'Reels'))
      )
      AND (
        (platform = 'Facebook' AND content_type = 'Gönderi')
        OR length(trim(COALESCE(media_url, ''))) > 0
      )
      AND COALESCE(publish_attempt_count, 0) < ?
      AND (last_publish_attempt_at IS NULL OR last_publish_attempt_at <= ?)`;

  // Satır kendi scheduled_time'ını taşıyorsa (Europe/Istanbul HH:MM) global SOCIAL_AUTO_PUBLISH_TIME
  // yerine o kullanılır - aynı gün içindeki farklı içerikleri farklı saatlere yayarak "hepsi aynı anda
  // due olur, cron art arda tikte hepsini boşaltır" content-patlaması riskini engeller. scheduled_time
  // NULL ise (eski satırlar) eski davranış (tek global saat) aynen korunur.
  const dateClause = `(
    scheduled_date < ?
    OR (scheduled_date = ? AND ? >= COALESCE(NULLIF(trim(scheduled_time), ''), ?))
  )`;
  const result = await env.DB.prepare(`SELECT id, villa, platform, content_type, scheduled_date, publish_attempt_count
    FROM social_posts
    WHERE ${commonFilter}
      AND ${dateClause}
    ORDER BY scheduled_date ASC, COALESCE(scheduled_time, '99:99') ASC, COALESCE(approved_at, created_at) ASC
    LIMIT ?`)
    .bind(MAX_ATTEMPTS, cooldownBefore, clock.date, clock.date, clock.time, publishTime, limit)
    .all();

  return result.results ?? [];
}

async function publishThroughApp(post, env, ctx) {
  const baseUrl = String(env.APP_BASE_URL ?? "https://admin.safiradestan.com").replace(/\/$/, "");
  const endpoint = post.platform === "Instagram"
    ? "/api/meta/instagram/publish"
    : "/api/meta/facebook/publish";
  const targetUrl = `${baseUrl}${endpoint}`;

  // KRİTİK: nextWorker.fetch() burada gerçek bir ağ isteği değil, doğrudan in-process çağrı -
  // bu yüzden hiçbir alt katman otomatik "Host" header'ı eklemiyor. src/middleware.ts yönlendirme
  // kararını TAMAMEN request.headers.get("host")'a göre veriyor (URL'in kendi host'una değil);
  // Host header'ı yoksa middleware boş string'i hiçbir bilinen host'a (ADMIN_HOSTS/PUBLIC_HOSTS/
  // workers.dev/local) eşleştiremeyip sessizce 404 döndürüyor - gerçek /api/meta/*/publish route'una
  // hiç ulaşılmıyor. 2026-08-30'dan beri otomatik yayının hiçbir iz bırakmadan (D1'e attempt/hata
  // yazılmadan) sessizce başarısız olmasının kök nedeni buydu - route'un kendisi hiç çalışmıyordu.
  const response = await nextWorker.fetch(new Request(targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Host: new URL(targetUrl).host },
    body: JSON.stringify({ postId: post.id }),
  }), env, ctx);

  if (response.ok) {
    console.log(`[Social Cron] Villa ${post.villa} ${post.platform} ${post.content_type} yayını tamamlandı.`);
    return "success";
  }

  const payload = await response.json().catch(() => ({}));
  if (response.status === 409) {
    console.log(`[Social Cron] ${post.platform} ${post.id} atlandı: ${safeCronError(payload.error ?? "artık uygun değil")}`);
    return "skipped";
  }
  console.error(`[Social Cron] ${post.platform} ${post.id} HTTP ${response.status}: ${safeCronError(payload.error)}`);
  return "error";
}

// Cron'un kendisinin gerçekten çalışıp çalışmadığını admin panelinde dürüstçe gösterebilmek için
// (D1'e yalnız bir yayın DENEMESİ olduğunda satır düşer - aday yoksa hiçbir iz kalmaz) her tikte
// META_PRIVATE KV'ye küçük bir "heartbeat" yazılır. Bu satır SocialPublishHealth panelindeki
// "son cron", "bu turdaki aday sayısı", "başarı/hata" alanlarının tek gerçek kaynağıdır.
async function writeSocialCronHeartbeat(env, ranAt, counts) {
  try {
    await env.META_PRIVATE.put("social_cron_heartbeat", JSON.stringify({ ranAt, ...counts }));
  } catch (error) {
    console.error(`[Social Cron] Heartbeat yazılamadı: ${safeCronError(error)}`);
  }
}

async function runSocialCron(controller, env, ctx) {
  const ranAt = new Date(controller.scheduledTime).toISOString();

  if (String(env.SOCIAL_AUTO_PUBLISH_ENABLED ?? "true").toLowerCase() !== "true") {
    console.log("[Social Cron] Otomatik yayın kapalı.");
    await writeSocialCronHeartbeat(env, ranAt, { enabled: false, candidateCount: 0, successCount: 0, skippedCount: 0, errorCount: 0 });
    return;
  }

  let posts;
  try {
    posts = await duePosts(env, new Date(controller.scheduledTime));
  } catch (error) {
    console.error(`[Social Cron] D1 sorgusu başarısız: ${safeCronError(error)}`);
    await writeSocialCronHeartbeat(env, ranAt, { enabled: true, candidateCount: 0, successCount: 0, skippedCount: 0, errorCount: 0, queryFailed: true });
    return;
  }

  if (!posts.length) {
    console.log("[Social Cron] Yayına hazır zamanı gelmiş içerik yok.");
    await writeSocialCronHeartbeat(env, ranAt, { enabled: true, candidateCount: 0, successCount: 0, skippedCount: 0, errorCount: 0 });
    return;
  }

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  for (const post of posts) {
    try {
      const outcome = await publishThroughApp(post, env, ctx);
      if (outcome === "success") successCount += 1;
      else if (outcome === "skipped") skippedCount += 1;
      else errorCount += 1;
    } catch (error) {
      errorCount += 1;
      console.error(`[Social Cron] ${post.platform} ${post.id} çağrısı başarısız: ${safeCronError(error)}`);
    }
  }
  await writeSocialCronHeartbeat(env, ranAt, { enabled: true, candidateCount: posts.length, successCount, skippedCount, errorCount });
}

// ============ OTA (Airbnb/Booking) takvim senkronu ============
// NOT: Bu mantık src/lib/ota/*.ts'nin BİLİNÇLİ, bağımsız bir aynası. custom-worker.mjs Next.js'in
// "@/" path alias'larını çözemez (nextWorker zaten derlenmiş OpenNext çıktısı, TS kaynağı değil) -
// bu yüzden cron tarafı burada saf JS olarak yeniden yazıldı, tıpkı runSocialCron'un src/lib/
// social-db.ts yerine D1'i doğrudan sorgulaması gibi (mevcut, önceden var olan bir desen).
// SSRF allowlist'ini DEĞİŞTİRİRSEN src/lib/ota/security.ts'i de güncelle (ve tersi) - iki kopya da
// aynı kalmalı.

const OTA_VILLAS = ["Safira", "Destan"];
const OTA_PLATFORMS = ["airbnb", "booking"];
// Kullanıcı production'da gerçek export URL'leriyle doğruladı - bkz. src/lib/ota/security.ts'teki
// aynı ALLOWLIST için detaylı yorum. İki kopya da aynı host/path kuralını taşımalı.
const OTA_ALLOWLIST = {
  airbnb: { hosts: ["www.airbnb.com", "www.airbnb.com.tr"], pathPattern: /^\/calendar\/ical\/[0-9]+\.ics$/ },
  booking: { hosts: ["ical.booking.com"], pathPattern: /^\/v1\/export\/?$/ },
};
const OTA_PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i, /^127\./, /^0\.0\.0\.0$/, /^10\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./, /^169\.254\./, /^\[?::1\]?$/, /\.internal$/i, /^metadata\.google\.internal$/i,
];

function otaIsBlockedHostname(hostname) {
  return OTA_PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

function otaIsAllowed(url, platform) {
  if (url.protocol !== "https:") return false;
  if (otaIsBlockedHostname(url.hostname)) return false;
  const entry = OTA_ALLOWLIST[platform];
  if (!entry.hosts.includes(url.hostname.toLowerCase())) return false;
  return entry.pathPattern.test(url.pathname);
}

async function otaFetchIcsSafely(rawUrl, platform) {
  let current;
  try {
    current = new URL(rawUrl);
  } catch {
    throw new Error("URL biçimi geçersiz.");
  }
  for (let hop = 0; hop <= 3; hop += 1) {
    if (!otaIsAllowed(current, platform)) {
      throw new Error("Desteklenmeyen host veya path.");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response;
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
    if (!response.ok) throw new Error(`ICS fetch başarısız: HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 512 * 1024) throw new Error("ICS yanıtı beklenenden büyük.");
    return text;
  }
  throw new Error("Çok fazla redirect.");
}

function otaUnfoldIcs(text) {
  const rawLines = text.split(/\r\n|\n|\r/);
  const lines = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function otaParseDateValue(raw) {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function otaParseIcsEvents(icsText) {
  const lines = otaUnfoldIcs(icsText);
  const events = [];
  let inEvent = false, uid = null, start = null, end = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { inEvent = true; uid = null; start = null; end = null; continue; }
    if (line === "END:VEVENT") {
      if (inEvent && uid && start && end) events.push({ uid, startDate: start, endDate: end });
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const key = line.slice(0, sep).split(";")[0].toUpperCase();
    const value = line.slice(sep + 1);
    if (key === "UID") uid = value.trim();
    else if (key === "DTSTART") start = otaParseDateValue(value);
    else if (key === "DTEND") end = otaParseDateValue(value);
  }
  return events;
}

function otaSanitizeError(message) {
  return String(message).replace(/(https?:\/\/[^\s?]+)\?[^\s]*/gi, "$1?[redacted]").slice(0, 500);
}

async function otaLogAudit(env, action, payload) {
  await env.DB.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, ?, ?, ?)")
    .bind(payload.villa, action, JSON.stringify(payload), new Date().toISOString()).run();
}

async function otaSyncOneConnection(env, villa, platform) {
  const connRow = await env.DB.prepare("SELECT is_enabled FROM ota_connections WHERE villa = ? AND platform = ?").bind(villa, platform).first();
  if (!connRow || !connRow.is_enabled) return;

  const importUrl = await env.OTA_PRIVATE.get(`import-url:${villa}:${platform}`);
  if (!importUrl) return;

  const now = new Date().toISOString();
  let icsText;
  try {
    icsText = await otaFetchIcsSafely(importUrl, platform);
  } catch (error) {
    const message = otaSanitizeError(error instanceof Error ? error.message : String(error));
    await env.DB.prepare("UPDATE ota_connections SET last_synced_at = ?, last_error = ?, updated_at = ? WHERE villa = ? AND platform = ?")
      .bind(now, message, now, villa, platform).run();
    await otaLogAudit(env, "ICAL_SYNC_FAILED", { villa, source: platform, error: message });
    return;
  }

  const events = otaParseIcsEvents(icsText);
  const seenUids = new Set();

  for (const event of events) {
    seenUids.add(event.uid);
    const existing = await env.DB.prepare(
      "SELECT id, start_date, end_date, status FROM external_blocks WHERE villa = ? AND source = ? AND external_uid = ?"
    ).bind(villa, platform, event.uid).first();

    const directConflict = await env.DB.prepare(
      "SELECT id FROM reservations WHERE villa = ? AND deleted_at IS NULL AND check_in < ? AND check_out > ? LIMIT 1"
    ).bind(villa, event.endDate, event.startDate).first();
    const otherOtaConflict = await env.DB.prepare(
      "SELECT id FROM external_blocks WHERE villa = ? AND source != ? AND status IN ('active','needs_review') AND start_date < ? AND end_date > ? LIMIT 1"
    ).bind(villa, platform, event.endDate, event.startDate).first();
    const nextStatus = directConflict || otherOtaConflict ? "needs_review" : "active";

    if (!existing) {
      await env.DB.prepare(`
        INSERT INTO external_blocks (id, villa, source, external_uid, start_date, end_date, status, last_synced_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), villa, platform, event.uid, event.startDate, event.endDate, nextStatus, now, now, now).run();
      await otaLogAudit(env, "EXTERNAL_BLOCK_CREATED", { villa, source: platform, startDate: event.startDate, endDate: event.endDate });
      if (nextStatus === "needs_review") await otaLogAudit(env, "BOOKING_CONFLICT_DETECTED", { villa, source: platform, startDate: event.startDate, endDate: event.endDate });
    } else {
      const changed = existing.start_date !== event.startDate || existing.end_date !== event.endDate || existing.status !== nextStatus;
      if (changed) {
        await env.DB.prepare("UPDATE external_blocks SET start_date = ?, end_date = ?, status = ?, last_synced_at = ?, updated_at = ? WHERE id = ?")
          .bind(event.startDate, event.endDate, nextStatus, now, now, existing.id).run();
        await otaLogAudit(env, "EXTERNAL_BLOCK_UPDATED", { villa, source: platform, startDate: event.startDate, endDate: event.endDate });
        if (nextStatus === "needs_review" && existing.status !== "needs_review") {
          await otaLogAudit(env, "BOOKING_CONFLICT_DETECTED", { villa, source: platform, startDate: event.startDate, endDate: event.endDate });
        }
      } else {
        await env.DB.prepare("UPDATE external_blocks SET last_synced_at = ? WHERE id = ?").bind(now, existing.id).run();
      }
    }
  }

  const staleRows = await env.DB.prepare(
    "SELECT id, external_uid FROM external_blocks WHERE villa = ? AND source = ? AND status IN ('active','needs_review')"
  ).bind(villa, platform).all();
  for (const row of staleRows.results) {
    if (!seenUids.has(row.external_uid)) {
      await env.DB.prepare("UPDATE external_blocks SET status = 'removed', updated_at = ? WHERE id = ?").bind(now, row.id).run();
      await otaLogAudit(env, "EXTERNAL_BLOCK_REMOVED", { villa, source: platform });
    }
  }

  await env.DB.prepare("UPDATE ota_connections SET last_synced_at = ?, last_success_at = ?, last_error = NULL, updated_at = ? WHERE villa = ? AND platform = ?")
    .bind(now, now, now, villa, platform).run();
  await otaLogAudit(env, "ICAL_SYNC_SUCCESS", { villa, source: platform, count: events.length });
}

async function runOtaCron(env) {
  for (const villa of OTA_VILLAS) {
    for (const platform of OTA_PLATFORMS) {
      try {
        await otaSyncOneConnection(env, villa, platform);
      } catch (error) {
        console.error(`[OTA Cron] ${villa}/${platform} beklenmeyen hata: ${safeCronError(error)}`);
      }
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Mobil (/api/mobile/v1/*) tamamen ayrı bir kapı - web'in cookie tabanlı adminAuthGate'inden
    // hiç geçmez (mobilin cookie'si yok, geçseydi 401 alırdı). Bearer doğrulaması burada, CORS
    // yalnız bu path grubuna uygulanır - geri kalan admin API yüzeyi hiç değişmedi.
    if (url.hostname.toLowerCase() === ADMIN_HOST && url.pathname.startsWith("/api/mobile/v1/")) {
      const mobileResponse = await mobileAuthGate(request, env);
      if (mobileResponse) return mobileResponse;

      const routed = routeRequest(request);
      if (routed.response) return routed.response;
      const response = await nextWorker.fetch(routed.request, env, ctx);
      return withMobileCors(response, request);
    }

    const authResponse = await adminAuthGate(request, env);
    if (authResponse) return authResponse;

    const routed = routeRequest(request);
    if (routed.response) return routed.response;
    return nextWorker.fetch(routed.request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof controller.noRetry === "function") controller.noRetry();
    if (controller.cron === "*/30 * * * *") {
      await runOtaCron(env);
      return;
    }
    await runSocialCron(controller, env, ctx);
  },
};
