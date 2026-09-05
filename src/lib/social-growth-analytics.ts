import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "./types";
import { getInstagramCredentials } from "./meta-store";
import { getInstagramPublishingLimit } from "./meta";

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

export type VillaPublishWindow = {
  windowDays: number;
  published: number;
  planned: number;
};

export type GrowthAnalyticsSnapshot = {
  villa: Villa;
  last7Days: VillaPublishWindow;
  last30Days: VillaPublishWindow;
  instagramQuota: { quotaUsage: number; quotaTotal: number; remaining: number } | null;
  note: string;
};

// Yalnız gerçekten sahip olduğumuz veriden türetilir: social_posts (kendi yayın geçmişimiz) ve
// Instagram content_publishing_limit (src/lib/meta.ts, zaten üretimde kullanılan API). followers/
// reach/impressions/engagement Meta'dan instagram_business_manage_insights izni olmadan
// OKUNAMAZ - bu yüzden burada YOK (bkz. social-growth-capabilities.ts GROWTH_INSIGHTS,
// available:false). Uydurma metrik eklenmez.
async function villaPublishWindow(db: D1Database, villa: Villa, windowDays: number, todayIso: string): Promise<VillaPublishWindow> {
  const sinceDate = new Date(Date.parse(todayIso) - windowDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const row = await db.prepare(
    `SELECT
       SUM(CASE WHEN status = 'Yayınlandı' AND published_at >= ? THEN 1 ELSE 0 END) as published,
       SUM(CASE WHEN status = 'Planlandı' THEN 1 ELSE 0 END) as planned
     FROM social_posts
     WHERE villa = ? AND platform = 'Instagram'`,
  ).bind(sinceDate, villa).first<{ published: number | null; planned: number | null }>();
  return { windowDays, published: row?.published ?? 0, planned: row?.planned ?? 0 };
}

export async function getGrowthAnalytics(villa: Villa, todayIso: string): Promise<GrowthAnalyticsSnapshot> {
  const db = await database();
  const [last7Days, last30Days] = await Promise.all([
    villaPublishWindow(db, villa, 7, todayIso),
    villaPublishWindow(db, villa, 30, todayIso),
  ]);

  let instagramQuota: GrowthAnalyticsSnapshot["instagramQuota"] = null;
  try {
    const credentials = await getInstagramCredentials(villa);
    if (credentials) {
      const quota = await getInstagramPublishingLimit(credentials.accountId, credentials.accessToken);
      instagramQuota = { quotaUsage: quota.quotaUsage, quotaTotal: quota.quotaTotal, remaining: quota.remaining };
    }
  } catch {
    instagramQuota = null;
  }

  return {
    villa,
    last7Days,
    last30Days,
    instagramQuota,
    note: "Takipçi/reach/impressions/engagement Meta izni (instagram_business_manage_insights) alınmadan gösterilemez.",
  };
}
