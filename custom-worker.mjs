import nextWorker from "./.open-next/worker.js";

const DEFAULT_PUBLISH_TIME = "12:00";
const DEFAULT_LIMIT = 2;
const MAX_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 30 * 60 * 1000;
const PUBLIC_HOSTS = new Set(["safiradestan.com", "www.safiradestan.com"]);
const ADMIN_HOST = "admin.safiradestan.com";
const PUBLIC_API_PATHS = new Set([
  "/api/public/booking-inquiries",
]);
const PUBLIC_ROUTE_MAP = new Map([
  ["/", "/site"],
  ["/villa-safira", "/site/villa-safira"],
  ["/villa-destan", "/site/villa-destan"],
]);
const TRANSITION_PATHS = new Set([
  "/api/health",
  "/api/system/version",
  "/api/meta/instagram/callback",
  "/api/meta/facebook/callback",
]);

const ADMIN_LOGIN_PATH = "/login";
const ADMIN_LOGIN_API = "/api/auth/login";
const ADMIN_LOGOUT_API = "/api/auth/logout";
const ADMIN_PUBLIC_PATHS = new Set([
  ADMIN_LOGIN_PATH,
  "/api/health",
  "/api/system/version",
  "/api/meta/instagram/callback",
  "/api/meta/facebook/callback",
]);
const ADMIN_SESSION_COOKIE = "__Host-villa_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60;
const ADMIN_MIN_PASSWORD_LENGTH = 12;
const ADMIN_MIN_SESSION_SECRET_LENGTH = 32;
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
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";
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
      return PUBLIC_API_PATHS.has(url.pathname)
        ? { request }
        : { response: new Response("Not Found", { status: 404 }) };
    }

    if (publicAssetPath(url.pathname)) return { request };

    const target = PUBLIC_ROUTE_MAP.get(url.pathname);
    if (!target) return { response: new Response("Not Found", { status: 404 }) };

    url.pathname = target;
    return { request: new Request(url.toString(), request) };
  }

  if (host === ADMIN_HOST) return { request };

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

async function createAdminSession(secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(TEXT_ENCODER.encode(JSON.stringify({
    v: 1,
    iat: now,
    exp: now + ADMIN_SESSION_TTL_SECONDS,
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

async function verifyAdminSession(request, secret) {
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
    return data?.v === 1 &&
      Number.isInteger(data.iat) &&
      Number.isInteger(data.exp) &&
      data.iat <= now + 60 &&
      data.exp > now;
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

function adminAuthConfigured(env) {
  return typeof env.ADMIN_PASSWORD === "string" &&
    env.ADMIN_PASSWORD.length >= ADMIN_MIN_PASSWORD_LENGTH &&
    typeof env.ADMIN_SESSION_SECRET === "string" &&
    env.ADMIN_SESSION_SECRET.length >= ADMIN_MIN_SESSION_SECRET_LENGTH;
}

async function handleAdminLogin(request, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405, { Allow: "POST" });
  }
  if (!adminAuthConfigured(env)) {
    console.error("[Admin Auth] Required secrets are missing or too short.");
    return jsonResponse({ error: "Yönetim girişi geçici olarak kullanılamıyor." }, 503);
  }

  const payload = await request.json().catch(() => null);
  const password = typeof payload?.password === "string" ? payload.password : "";
  if (password.length < ADMIN_MIN_PASSWORD_LENGTH || password.length > 256) {
    return jsonResponse({ error: "Parola hatalı." }, 401);
  }

  const matches = await safePasswordMatch(password, env.ADMIN_PASSWORD);
  if (!matches) {
    return jsonResponse({ error: "Parola hatalı." }, 401);
  }

  const session = await createAdminSession(env.ADMIN_SESSION_SECRET);
  return jsonResponse(
    { ok: true, expiresIn: ADMIN_SESSION_TTL_SECONDS },
    200,
    {
      "Set-Cookie": `${ADMIN_SESSION_COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
    },
  );
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

async function adminAuthGate(request, env) {
  const url = new URL(request.url);
  if (url.hostname.toLowerCase() !== ADMIN_HOST) return null;

  if (url.pathname === ADMIN_LOGIN_API) return handleAdminLogin(request, env);
  if (url.pathname === ADMIN_LOGOUT_API) return handleAdminLogout(request);
  if (adminPublicAssetPath(url.pathname) || ADMIN_PUBLIC_PATHS.has(url.pathname)) return null;

  const authenticated = await verifyAdminSession(request, env.ADMIN_SESSION_SECRET);
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

async function duePosts(env, scheduledAt) {
  const clock = istanbulClock(scheduledAt);
  const publishTime = safeTime(env.SOCIAL_AUTO_PUBLISH_TIME);
  const limit = safeLimit(env.SOCIAL_AUTO_PUBLISH_LIMIT);
  const cooldownBefore = new Date(scheduledAt.getTime() - RETRY_COOLDOWN_MS).toISOString();
  const commonFilter = `status = 'Planlandı'
      AND approval_status = 'Onaylandı'
      AND platform IN ('Instagram', 'Facebook')
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

  const dateClause = clock.time < publishTime ? "scheduled_date < ?" : "scheduled_date <= ?";
  const result = await env.DB.prepare(`SELECT id, villa, platform, content_type, scheduled_date, publish_attempt_count
    FROM social_posts
    WHERE ${commonFilter}
      AND ${dateClause}
    ORDER BY scheduled_date ASC, COALESCE(approved_at, created_at) ASC
    LIMIT ?`)
    .bind(MAX_ATTEMPTS, cooldownBefore, clock.date, limit)
    .all();

  return result.results ?? [];
}

async function publishThroughApp(post, env, ctx) {
  const baseUrl = String(env.APP_BASE_URL ?? "https://admin.safiradestan.com").replace(/\/$/, "");
  const endpoint = post.platform === "Instagram"
    ? "/api/meta/instagram/publish"
    : "/api/meta/facebook/publish";

  const response = await nextWorker.fetch(new Request(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: post.id }),
  }), env, ctx);

  if (response.ok) {
    console.log(`[Social Cron] Villa ${post.villa} ${post.platform} ${post.content_type} yayını tamamlandı.`);
    return;
  }

  const payload = await response.json().catch(() => ({}));
  if (response.status === 409) {
    console.log(`[Social Cron] ${post.platform} ${post.id} atlandı: ${safeCronError(payload.error ?? "artık uygun değil")}`);
    return;
  }
  console.error(`[Social Cron] ${post.platform} ${post.id} HTTP ${response.status}: ${safeCronError(payload.error)}`);
}

async function runSocialCron(controller, env, ctx) {
  if (String(env.SOCIAL_AUTO_PUBLISH_ENABLED ?? "true").toLowerCase() !== "true") {
    console.log("[Social Cron] Otomatik yayın kapalı.");
    return;
  }

  let posts;
  try {
    posts = await duePosts(env, new Date(controller.scheduledTime));
  } catch (error) {
    console.error(`[Social Cron] D1 sorgusu başarısız: ${safeCronError(error)}`);
    return;
  }

  if (!posts.length) {
    console.log("[Social Cron] Yayına hazır zamanı gelmiş içerik yok.");
    return;
  }

  for (const post of posts) {
    try {
      await publishThroughApp(post, env, ctx);
    } catch (error) {
      console.error(`[Social Cron] ${post.platform} ${post.id} çağrısı başarısız: ${safeCronError(error)}`);
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const authResponse = await adminAuthGate(request, env);
    if (authResponse) return authResponse;

    const routed = routeRequest(request);
    if (routed.response) return routed.response;
    return nextWorker.fetch(routed.request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof controller.noRetry === "function") controller.noRetry();
    await runSocialCron(controller, env, ctx);
  },
};
