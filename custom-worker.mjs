import nextWorker from "./.open-next/worker.js";

const DEFAULT_PUBLISH_TIME = "12:00";
const DEFAULT_LIMIT = 2;
const MAX_ATTEMPTS = 3;
const RETRY_COOLDOWN_MS = 30 * 60 * 1000;

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

async function duePosts(env, scheduledAt) {
  const clock = istanbulClock(scheduledAt);
  const publishTime = safeTime(env.SOCIAL_AUTO_PUBLISH_TIME);
  const limit = safeLimit(env.SOCIAL_AUTO_PUBLISH_LIMIT);
  const cooldownBefore = new Date(scheduledAt.getTime() - RETRY_COOLDOWN_MS).toISOString();
  const commonFilter = `status = 'Planlandı'
      AND approval_status = 'Onaylandı'
      AND platform IN ('Instagram', 'Facebook')
      AND content_type = 'Gönderi'
      AND (platform = 'Facebook' OR length(trim(COALESCE(media_url, ''))) > 0)
      AND COALESCE(publish_attempt_count, 0) < ?
      AND (last_publish_attempt_at IS NULL OR last_publish_attempt_at <= ?)`;

  const dateClause = clock.time < publishTime ? "scheduled_date < ?" : "scheduled_date <= ?";
  const result = await env.DB.prepare(`SELECT id, villa, platform, scheduled_date, publish_attempt_count
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
  const baseUrl = String(env.APP_BASE_URL ?? "https://villa-yonetim.caglarmurat10.workers.dev").replace(/\/$/, "");
  const endpoint = post.platform === "Instagram"
    ? "/api/meta/instagram/publish"
    : "/api/meta/facebook/publish";

  const response = await nextWorker.fetch(new Request(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId: post.id }),
  }), env, ctx);

  if (response.ok) {
    console.log(`[Social Cron] Villa ${post.villa} ${post.platform} yayını tamamlandı.`);
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
    return nextWorker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof controller.noRetry === "function") controller.noRetry();
    await runSocialCron(controller, env, ctx);
  },
};
