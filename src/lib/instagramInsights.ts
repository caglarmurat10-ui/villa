import type { D1Database } from "@cloudflare/workers-types";
import { getInstagramAccessTokenFromEnv } from "./instagramTokenStore";
import { getInstagramAccountFromEnv } from "./meta-store";
import { ensureSocialOperationsTables } from "./socialOperationsDb";
import type { Villa } from "./types";

const GRAPH = "https://graph.instagram.com";
const accountMetrics = ["reach", "views", "accounts_engaged", "total_interactions", "profile_views", "website_clicks"];
const commonMediaMetrics = ["comments", "likes", "saved", "shares", "reach", "views"];

type MetaMetric = { name?: unknown; values?: unknown; total_value?: unknown };
type MetaError = { code?: unknown; error_subcode?: unknown };

export type InsightsPermissionStatus = "unknown" | "ready" | "reauthorization_required" | "error";

export function parseInsightsMetrics(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || !("data" in value) || !Array.isArray((value as { data?: unknown }).data)) return {};
  const metrics: Record<string, number> = {};
  for (const item of (value as { data: MetaMetric[] }).data) {
    if (typeof item.name !== "string") continue;
    const total = item.total_value && typeof item.total_value === "object" &&
      "value" in item.total_value && typeof (item.total_value as { value?: unknown }).value === "number"
      ? (item.total_value as { value: number }).value : null;
    const values = Array.isArray(item.values) ? item.values : [];
    const value = total ?? [...values].reverse().find((entry) => entry && typeof entry === "object" &&
      "value" in entry && typeof (entry as { value?: unknown }).value === "number");
    const numeric = typeof value === "number" ? value : value && typeof value === "object"
      ? (value as { value: number }).value : null;
    if (typeof numeric === "number" && Number.isFinite(numeric)) metrics[item.name] = numeric;
  }
  return metrics;
}

export function insightsPermissionStatus(status: number, value: unknown): InsightsPermissionStatus {
  const error = value && typeof value === "object" && "error" in value
    ? (value as { error?: MetaError }).error : undefined;
  const code = typeof error?.code === "number" ? error.code : null;
  return (status === 400 || status === 403) && (code === 10 || code === 190 || code === 200)
    ? "reauthorization_required" : "error";
}

async function graphJson(path: string, token: string) {
  const response = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: unknown = await response.json().catch(() => ({}));
  return { response, data };
}

function istanbulDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now);
}

export function insightsSyncBucket(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}:${Number(value.hour) < 12 ? "am" : "pm"}`;
}

async function setSyncState(db: D1Database, villa: Villa, bucket: string, status: InsightsPermissionStatus, success: boolean) {
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO instagram_insights_sync_state
    (villa,last_bucket,last_success_at,permission_status,last_error,updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(villa) DO UPDATE SET last_bucket=excluded.last_bucket,
      last_success_at=COALESCE(excluded.last_success_at,instagram_insights_sync_state.last_success_at),
      permission_status=excluded.permission_status,last_error=excluded.last_error,updated_at=excluded.updated_at`)
    .bind(villa, bucket, success ? now : null, status, status === "reauthorization_required" ? "Yeniden yetkilendirme gerekiyor." : status === "error" ? "Insights geçici olarak alınamadı." : null, now).run();
}

export async function syncVillaInsights(env: CloudflareEnv, villa: Villa, now = new Date()) {
  await ensureSocialOperationsTables(env.DB);
  const bucket = insightsSyncBucket(now);
  const state = await env.DB.prepare("SELECT last_bucket FROM instagram_insights_sync_state WHERE villa=?")
    .bind(villa).first<{ last_bucket: string | null }>();
  if (state?.last_bucket === bucket) return { skipped: true, status: "ready" as const };
  const account = await getInstagramAccountFromEnv(env, villa);
  if (!account) {
    await setSyncState(env.DB, villa, bucket, "error", false);
    return { skipped: true, status: "error" as const };
  }
  const token = await getInstagramAccessTokenFromEnv(env, villa, account.accountId);
  if (!token) {
    await setSyncState(env.DB, villa, bucket, "reauthorization_required", false);
    return { skipped: true, status: "reauthorization_required" as const };
  }

  const profile = await graphJson(`/me?fields=id,username,followers_count`, token);
  if (!profile.response.ok) {
    const status = insightsPermissionStatus(profile.response.status, profile.data);
    await setSyncState(env.DB, villa, bucket, status, false);
    return { skipped: false, status };
  }
  const profileData = profile.data as { id?: unknown; followers_count?: unknown };
  const accountInsight = await graphJson(`/${encodeURIComponent(account.accountId)}/insights?metric=${accountMetrics.join(",")}&period=day`, token);
  if (!accountInsight.response.ok) {
    const status = insightsPermissionStatus(accountInsight.response.status, accountInsight.data);
    await setSyncState(env.DB, villa, bucket, status, false);
    return { skipped: false, status };
  }
  const metrics = parseInsightsMetrics(accountInsight.data);
  const snapshotDate = istanbulDate(now);
  await env.DB.prepare(`INSERT INTO instagram_account_insights_daily
    (id,villa,instagram_user_id,snapshot_date,followers,metrics_json,created_at) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(villa,snapshot_date) DO UPDATE SET followers=excluded.followers,
      metrics_json=excluded.metrics_json,created_at=excluded.created_at`)
    .bind(crypto.randomUUID(), villa, typeof profileData.id === "string" ? profileData.id : account.accountId,
      snapshotDate, typeof profileData.followers_count === "number" ? profileData.followers_count : null,
      JSON.stringify(metrics), now.toISOString()).run();

  const logs = await env.DB.prepare(`SELECT log.instagram_media_id,log.caption,log.published_at,
      COALESCE(details.publish_type,'IMAGE') AS media_type
    FROM instagram_publish_log log LEFT JOIN instagram_publish_log_details details ON details.log_id=log.id
    WHERE log.villa=? AND log.status='Yayınlandı' AND log.instagram_media_id IS NOT NULL
    ORDER BY log.published_at DESC LIMIT 12`).bind(villa).all<{
      instagram_media_id: string; caption: string; published_at: string | null; media_type: string;
    }>();
  let mediaSynced = 0;
  for (const log of logs.results) {
    const previous = await env.DB.prepare("SELECT last_synced_at FROM instagram_media_insights WHERE instagram_media_id=?")
      .bind(log.instagram_media_id).first<{ last_synced_at: string }>();
    if (previous && now.getTime() - Date.parse(previous.last_synced_at) < 12 * 60 * 60 * 1000) continue;
    const names = log.media_type === "REELS" ? [...commonMediaMetrics, "plays"] : commonMediaMetrics;
    const response = await graphJson(`/${encodeURIComponent(log.instagram_media_id)}/insights?metric=${names.join(",")}`, token);
    if (!response.response.ok) continue;
    const mediaMetrics = parseInsightsMetrics(response.data);
    await env.DB.prepare(`INSERT INTO instagram_media_insights
      (id,villa,instagram_media_id,media_type,published_at,caption_preview,metrics_json,last_synced_at)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(instagram_media_id) DO UPDATE SET
        media_type=excluded.media_type,published_at=excluded.published_at,caption_preview=excluded.caption_preview,
        metrics_json=excluded.metrics_json,last_synced_at=excluded.last_synced_at`)
      .bind(crypto.randomUUID(), villa, log.instagram_media_id, log.media_type, log.published_at,
        log.caption.slice(0, 180), JSON.stringify(mediaMetrics), now.toISOString()).run();
    mediaSynced += 1;
  }
  await setSyncState(env.DB, villa, bucket, "ready", true);
  return { skipped: false, status: "ready" as const, mediaSynced };
}

export async function runInsightsSync(env: CloudflareEnv, now = new Date()) {
  const results = [];
  for (const villa of ["Destan", "Safira"] as const) {
    try {
      results.push({ villa, ...(await syncVillaInsights(env, villa, now)) });
    } catch {
      await setSyncState(env.DB, villa, insightsSyncBucket(now), "error", false);
      results.push({ villa, skipped: false, status: "error" as const });
    }
  }
  return results;
}

export async function getInsightsDashboard(db: D1Database) {
  await ensureSocialOperationsTables(db);
  const accounts = await db.prepare(`SELECT latest.*,state.permission_status,state.last_success_at,state.last_error
    FROM instagram_account_insights_daily latest
    LEFT JOIN instagram_insights_sync_state state ON state.villa=latest.villa
    WHERE latest.snapshot_date=(SELECT MAX(inner_row.snapshot_date) FROM instagram_account_insights_daily inner_row WHERE inner_row.villa=latest.villa)`)
    .all<Record<string, unknown>>();
  const states = await db.prepare("SELECT * FROM instagram_insights_sync_state").all<Record<string, unknown>>();
  const media = await db.prepare(`SELECT insights.*,log.image_url AS thumbnail_url,library.category
    FROM instagram_media_insights insights
    LEFT JOIN instagram_publish_log log ON log.instagram_media_id=insights.instagram_media_id
    LEFT JOIN social_media_library library ON library.public_url=log.image_url
    ORDER BY insights.published_at DESC LIMIT 100`).all<Record<string, unknown>>();
  const parsedMedia: Array<Record<string, unknown> & {
    metrics: Record<string, number>;
    villa?: unknown;
    category?: unknown;
    media_type?: unknown;
  }> = media.results.map((row) => ({ ...row,
    metrics: typeof row.metrics_json === "string" ? JSON.parse(row.metrics_json) as Record<string, number> : {} }));
  const recommendations: string[] = [];
  for (const villa of ["Destan", "Safira"] as const) {
    const items = parsedMedia.filter((item) => item.villa === villa);
    if (items.length < 5) continue;
    const categories = new Map<string, number>();
    for (const item of items.slice(0, 10)) {
      const category = typeof item.category === "string" ? item.category : String(item.media_type ?? "İçerik");
      categories.set(category, (categories.get(category) ?? 0) + 1);
    }
    const dominant = [...categories.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominant && dominant[1] >= 6) recommendations.push(`${villa}: Son 10 gönderinin ${dominant[1]} tanesi ${dominant[0]}; içerik çeşitliliğini artırın.`);
  }
  return { accounts: accounts.results.map((row) => ({ ...row,
    metrics: typeof row.metrics_json === "string" ? JSON.parse(row.metrics_json) : {} })), states: states.results,
    media: parsedMedia, recommendations };
}
