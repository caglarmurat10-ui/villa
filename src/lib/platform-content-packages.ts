import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import { buildPlatformPackages, type BuildPlatformPackagesInput, type OrganicPlatform, type PlatformPackage } from "./platform-repurposing";
import type { Villa } from "./types";

export interface StoredPlatformPackage extends PlatformPackage {
  id: string;
  villa: Villa;
  theme: string;
  campaignId: string;
  manualPublishState: "READY_FOR_MANUAL_PUBLISH" | "MANUALLY_PUBLISHED";
  manuallyPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type PackageRow = {
  id: string;
  villa: Villa;
  platform: OrganicPlatform;
  source_file_id: string;
  theme: string;
  campaign_id: string;
  title: string | null;
  caption: string;
  cta: string;
  hashtags: string;
  utm_url: string;
  recommended_ratio: PlatformPackage["recommendedRatio"];
  media_kind: PlatformPackage["mediaKind"];
  manual_publish_state: StoredPlatformPackage["manualPublishState"];
  manually_published_at: string | null;
  created_at: string;
  updated_at: string;
};

let tableReady: Promise<void> | null = null;

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

async function prepareTable(db: D1Database): Promise<void> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS platform_content_packages (
      id TEXT PRIMARY KEY, villa TEXT NOT NULL, platform TEXT NOT NULL, source_file_id TEXT NOT NULL,
      theme TEXT NOT NULL, campaign_id TEXT NOT NULL, title TEXT, caption TEXT NOT NULL, cta TEXT NOT NULL,
      hashtags TEXT NOT NULL, utm_url TEXT NOT NULL, recommended_ratio TEXT NOT NULL, media_kind TEXT NOT NULL,
      manual_publish_state TEXT NOT NULL DEFAULT 'READY_FOR_MANUAL_PUBLISH', manually_published_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`.replace(/\s+/g, " "),
  );
}

async function ensureTable(db: D1Database): Promise<void> {
  if (!tableReady) {
    tableReady = prepareTable(db).catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

function mapRow(row: PackageRow): StoredPlatformPackage {
  return {
    id: row.id,
    villa: row.villa,
    platform: row.platform,
    theme: row.theme,
    campaignId: row.campaign_id,
    title: row.title,
    caption: row.caption,
    cta: row.cta,
    hashtags: JSON.parse(row.hashtags) as string[],
    utmUrl: row.utm_url,
    recommendedRatio: row.recommended_ratio,
    mediaKind: row.media_kind,
    sourceFileId: row.source_file_id,
    manualPublishState: row.manual_publish_state,
    manuallyPublishedAt: row.manually_published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type GeneratePackagesResult =
  | { ok: true; packages: StoredPlatformPackage[] }
  | { ok: false; error: string };

// buildPlatformPackages() (pure fonksiyon, property/REAL_UPLOAD doğrulaması dahil) ile D1 yazımını
// birleştirir - doğrulama BAŞARISIZ olursa D1'e HİÇBİR satır yazılmaz (fail closed, kısmi/geçersiz
// paket seti asla kaydedilmez).
export async function generateAndStorePackages(input: BuildPlatformPackagesInput): Promise<GeneratePackagesResult> {
  const result = buildPlatformPackages(input);
  if (!result.ok) return result;

  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  const stored: StoredPlatformPackage[] = [];

  for (const pkg of result.packages) {
    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO platform_content_packages
        (id, villa, platform, source_file_id, theme, campaign_id, title, caption, cta, hashtags, utm_url, recommended_ratio, media_kind, manual_publish_state, manually_published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'READY_FOR_MANUAL_PUBLISH', NULL, ?, ?)`,
    ).bind(
      id, input.villa, pkg.platform, pkg.sourceFileId, input.theme, input.campaignId,
      pkg.title, pkg.caption, pkg.cta, JSON.stringify(pkg.hashtags), pkg.utmUrl, pkg.recommendedRatio, pkg.mediaKind,
      now, now,
    ).run();
    stored.push({
      ...pkg, id, villa: input.villa, theme: input.theme, campaignId: input.campaignId,
      manualPublishState: "READY_FOR_MANUAL_PUBLISH", manuallyPublishedAt: null, createdAt: now, updatedAt: now,
    });
  }

  return { ok: true, packages: stored };
}

export async function listPlatformPackages(filter?: { villa?: Villa; platform?: OrganicPlatform }): Promise<StoredPlatformPackage[]> {
  const db = await database();
  await ensureTable(db);
  const conditions: string[] = [];
  const params: string[] = [];
  if (filter?.villa) { conditions.push("villa = ?"); params.push(filter.villa); }
  if (filter?.platform) { conditions.push("platform = ?"); params.push(filter.platform); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.prepare(`SELECT * FROM platform_content_packages ${where} ORDER BY created_at DESC LIMIT 100`).bind(...params).all<PackageRow>();
  return (result.results ?? []).map(mapRow);
}

export async function markPackageManuallyPublished(id: string): Promise<StoredPlatformPackage | null> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE platform_content_packages SET manual_publish_state = 'MANUALLY_PUBLISHED', manually_published_at = ?, updated_at = ?
     WHERE id = ? AND manual_publish_state = 'READY_FOR_MANUAL_PUBLISH'`,
  ).bind(now, now, id).run();
  const row = await db.prepare("SELECT * FROM platform_content_packages WHERE id = ?").bind(id).first<PackageRow>();
  return row ? mapRow(row) : null;
}
