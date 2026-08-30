import nextWorker from "./.open-next/worker.js";

const DEFAULT_PUBLISH_TIME = "12:00";
const DEFAULT_LIMIT = 2;
const MAX_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 30 * 60 * 1000;
const PUBLIC_HOSTS = new Set(["safiradestan.com", "www.safiradestan.com"]);
const ADMIN_HOST = "admin.safiradestan.com";
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
    pathname.startsWith("/media/") ||
    pathname === "/app-icon.svg" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";
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
      return { response: new Response("Not Found", { status: 404 }) };
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
  fetch(request, env, ctx) {
    const routed = routeRequest(request);
    if (routed.response) return routed.response;
    return nextWorker.fetch(routed.request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof controller.noRetry === "function") controller.noRetry();
    await runSocialCron(controller, env, ctx);
  },
};
