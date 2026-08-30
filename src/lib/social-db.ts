import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { SocialPost, SocialPostApproval, SocialPostStatus } from "./types";
import type { SocialPostInput } from "./schema";

type SocialPostRow = {
  id: string;
  villa: SocialPost["villa"];
  platform: SocialPost["platform"];
  content_type: SocialPost["contentType"];
  scheduled_date: string;
  caption: string;
  media_url?: string | null;
  status: SocialPostStatus;
  approval_status?: SocialPostApproval | null;
  approved_at?: string | null;
  published_at: string | null;
  platform_post_id?: string | null;
  publish_attempt_count?: number | null;
  last_publish_attempt_at?: string | null;
  last_publish_error?: string | null;
  publish_lock_token?: string | null;
  publish_lock_expires_at?: string | null;
  created_at: string;
  updated_at: string;
};

type SocialPostIdentityRow = Pick<SocialPostRow, "id" | "villa" | "platform" | "content_type" | "scheduled_date" | "caption" | "media_url" | "status">;

export type SocialPublishClaim = {
  post: SocialPost;
  lockToken: string;
};

let tableReady: Promise<void> | null = null;
const PUBLISH_LOCK_MS = 5 * 60 * 1000;

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

function mapRow(row: SocialPostRow): SocialPost {
  return {
    id: row.id,
    villa: row.villa,
    platform: row.platform,
    contentType: row.content_type,
    scheduledDate: row.scheduled_date,
    caption: row.caption,
    mediaUrl: row.media_url ?? "",
    status: row.status,
    approvalStatus: row.approval_status ?? "İnsan onayı",
    approvedAt: row.approved_at ?? null,
    publishedAt: row.published_at,
    platformPostId: row.platform_post_id ?? null,
    publishAttemptCount: Number(row.publish_attempt_count ?? 0),
    lastPublishAttemptAt: row.last_publish_attempt_at ?? null,
    lastPublishError: row.last_publish_error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function identity(input: Pick<SocialPostInput, "villa" | "platform" | "contentType" | "scheduledDate" | "caption">) {
  return `${input.villa}\u001f${input.platform}\u001f${input.contentType}\u001f${input.scheduledDate}\u001f${input.caption}`;
}

async function prepareTable(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS social_posts (
      id TEXT PRIMARY KEY,
      villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
      platform TEXT NOT NULL CHECK (platform IN ('Instagram', 'Facebook', 'TikTok', 'WhatsApp Durum')),
      content_type TEXT NOT NULL CHECK (content_type IN ('Gönderi', 'Hikâye', 'Reels', 'Durum')),
      scheduled_date TEXT NOT NULL,
      caption TEXT NOT NULL CHECK (length(caption) BETWEEN 1 AND 2200),
      media_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Planlandı' CHECK (status IN ('Planlandı', 'Yayınlandı')),
      approval_status TEXT NOT NULL DEFAULT 'İnsan onayı' CHECK (approval_status IN ('İnsan onayı', 'Onaylandı')),
      approved_at TEXT,
      published_at TEXT,
      platform_post_id TEXT,
      publish_attempt_count INTEGER NOT NULL DEFAULT 0,
      last_publish_attempt_at TEXT,
      last_publish_error TEXT,
      publish_lock_token TEXT,
      publish_lock_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS social_posts_schedule_idx ON social_posts (status, scheduled_date)"),
  ]);

  // Eski deployment'larda eksik sütunları isolate başına yalnız bir kez tamamla.
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN media_url TEXT NOT NULL DEFAULT ''").run(); } catch {}
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'İnsan onayı' CHECK (approval_status IN ('İnsan onayı', 'Onaylandı'))").run(); } catch {}
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN approved_at TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN platform_post_id TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN publish_attempt_count INTEGER NOT NULL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN last_publish_attempt_at TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN last_publish_error TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN publish_lock_token TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN publish_lock_expires_at TEXT").run(); } catch {}
  try { await db.prepare("CREATE INDEX IF NOT EXISTS social_posts_publish_state_idx ON social_posts (status, approval_status, scheduled_date, last_publish_attempt_at)").run(); } catch {}
}

async function ensureTable(db: D1Database) {
  if (!tableReady) {
    tableReady = prepareTable(db).catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

async function fetchSocialPost(db: D1Database, id: string): Promise<SocialPost | null> {
  const row = await db.prepare("SELECT * FROM social_posts WHERE id = ?").bind(id).first<SocialPostRow>();
  return row ? mapRow(row) : null;
}

export async function listSocialPosts(limit?: number): Promise<SocialPost[]> {
  const db = await database();
  await ensureTable(db);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.trunc(limit!))) : null;
  const sql = `SELECT * FROM social_posts
    ORDER BY CASE status WHEN 'Planlandı' THEN 0 ELSE 1 END, scheduled_date ASC, created_at DESC${safeLimit ? " LIMIT ?" : ""}`;
  const statement = safeLimit ? db.prepare(sql).bind(safeLimit) : db.prepare(sql);
  const result = await statement.all<SocialPostRow>();
  return result.results.map(mapRow);
}

export async function getSocialPost(id: string): Promise<SocialPost | null> {
  const db = await database();
  await ensureTable(db);
  return fetchSocialPost(db, id);
}

export async function createSocialPost(input: SocialPostInput): Promise<SocialPost> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  const post: SocialPost = {
    id: crypto.randomUUID(),
    ...input,
    status: "Planlandı",
    approvalStatus: "İnsan onayı",
    approvedAt: null,
    publishedAt: null,
    platformPostId: null,
    publishAttemptCount: 0,
    lastPublishAttemptAt: null,
    lastPublishError: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.prepare(`INSERT INTO social_posts
    (id, villa, platform, content_type, scheduled_date, caption, media_url, status, approval_status, approved_at, published_at, platform_post_id, publish_attempt_count, last_publish_attempt_at, last_publish_error, publish_lock_token, publish_lock_expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`).bind(
      post.id, post.villa, post.platform, post.contentType, post.scheduledDate, post.caption, post.mediaUrl,
      post.status, post.approvalStatus, post.approvedAt, post.publishedAt, post.platformPostId, post.publishAttemptCount,
      post.lastPublishAttemptAt, post.lastPublishError, post.createdAt, post.updatedAt,
    ).run();
  return post;
}

export async function seedSocialPosts(inputs: SocialPostInput[]) {
  const db = await database();
  await ensureTable(db);
  const existingRows = await db.prepare("SELECT id, villa, platform, content_type, scheduled_date, caption, media_url, status FROM social_posts").all<SocialPostIdentityRow>();
  const existing = new Map(existingRows.results.map((row) => [identity({
    villa: row.villa,
    platform: row.platform,
    contentType: row.content_type,
    scheduledDate: row.scheduled_date,
    caption: row.caption,
  }), row]));

  const pending: SocialPostInput[] = [];
  const updates: Array<{ id: string; mediaUrl: string }> = [];
  let skipped = 0;

  for (const input of inputs) {
    const row = existing.get(identity(input));
    if (!row) {
      pending.push(input);
      continue;
    }
    if (row.status === "Planlandı" && (row.media_url ?? "") !== input.mediaUrl) {
      updates.push({ id: row.id, mediaUrl: input.mediaUrl });
    } else {
      skipped += 1;
    }
  }

  const now = new Date().toISOString();
  const insertStatements = pending.map((input) => db.prepare(`INSERT INTO social_posts
    (id, villa, platform, content_type, scheduled_date, caption, media_url, status, approval_status, approved_at, published_at, platform_post_id, publish_attempt_count, last_publish_attempt_at, last_publish_error, publish_lock_token, publish_lock_expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Planlandı', 'İnsan onayı', NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, ?, ?)`)
    .bind(crypto.randomUUID(), input.villa, input.platform, input.contentType, input.scheduledDate, input.caption, input.mediaUrl, now, now));
  const updateStatements = updates.map((item) => db.prepare(`UPDATE social_posts
    SET media_url = ?, approval_status = 'İnsan onayı', approved_at = NULL, last_publish_error = NULL,
        publish_lock_token = NULL, publish_lock_expires_at = NULL, updated_at = ?
    WHERE id = ? AND status = 'Planlandı'`)
    .bind(item.mediaUrl, now, item.id));
  const statements = [...insertStatements, ...updateStatements];

  for (let index = 0; index < statements.length; index += 25) {
    await db.batch(statements.slice(index, index + 25));
  }

  return { created: pending.length, updated: updates.length, skipped, total: inputs.length };
}

export async function updateSocialPostApproval(id: string, approvalStatus: SocialPostApproval): Promise<SocialPost | null> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  const approvedAt = approvalStatus === "Onaylandı" ? now : null;
  await db.prepare(`UPDATE social_posts
    SET approval_status = ?, approved_at = ?,
        publish_lock_token = CASE WHEN ? = 'Onaylandı' THEN publish_lock_token ELSE NULL END,
        publish_lock_expires_at = CASE WHEN ? = 'Onaylandı' THEN publish_lock_expires_at ELSE NULL END,
        updated_at = ?
    WHERE id = ?`)
    .bind(approvalStatus, approvedAt, approvalStatus, approvalStatus, now, id).run();
  return fetchSocialPost(db, id);
}

/**
 * Bir paylaşımı Meta'ya göndermeden önce D1 üzerinde atomik olarak sahiplenir.
 * Aynı post için manuel buton ve cron eşzamanlı çalışsa bile yalnızca bir çağrı kilidi alabilir.
 */
export async function claimSocialPublishAttempt(id: string): Promise<SocialPublishClaim | null> {
  const db = await database();
  await ensureTable(db);
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const expiresAt = new Date(nowDate.getTime() + PUBLISH_LOCK_MS).toISOString();
  const lockToken = crypto.randomUUID();

  const result = await db.prepare(`UPDATE social_posts
    SET publish_lock_token = ?,
        publish_lock_expires_at = ?,
        publish_attempt_count = COALESCE(publish_attempt_count, 0) + 1,
        last_publish_attempt_at = ?,
        last_publish_error = NULL,
        updated_at = ?
    WHERE id = ?
      AND status = 'Planlandı'
      AND approval_status = 'Onaylandı'
      AND (publish_lock_token IS NULL OR publish_lock_expires_at IS NULL OR publish_lock_expires_at <= ?)`)
    .bind(lockToken, expiresAt, now, now, id, now).run();

  if ((result.meta.changes ?? 0) < 1) return null;
  const post = await fetchSocialPost(db, id);
  return post ? { post, lockToken } : null;
}

/** @deprecated Yeni kod claimSocialPublishAttempt kullanmalı. */
export async function beginSocialPublishAttempt(id: string): Promise<SocialPost | null> {
  const claim = await claimSocialPublishAttempt(id);
  return claim?.post ?? null;
}

export async function markSocialPublishFailure(id: string, lockToken: string, errorMessage: string): Promise<SocialPost | null> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  await db.prepare(`UPDATE social_posts
    SET last_publish_error = ?,
        publish_lock_token = NULL,
        publish_lock_expires_at = NULL,
        updated_at = ?
    WHERE id = ? AND status = 'Planlandı' AND publish_lock_token = ?`)
    .bind(errorMessage.slice(0, 500), now, id, lockToken).run();
  return fetchSocialPost(db, id);
}

export async function markSocialPublishSuccess(id: string, lockToken: string, platformPostId: string): Promise<SocialPost | null> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  await db.prepare(`UPDATE social_posts
    SET status = 'Yayınlandı',
        published_at = ?,
        platform_post_id = ?,
        last_publish_error = NULL,
        publish_lock_token = NULL,
        publish_lock_expires_at = NULL,
        updated_at = ?
    WHERE id = ? AND status = 'Planlandı' AND publish_lock_token = ?`)
    .bind(now, platformPostId, now, id, lockToken).run();
  return fetchSocialPost(db, id);
}

export async function updateSocialPostStatus(id: string, status: SocialPostStatus): Promise<SocialPost | null> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  const publishedAt = status === "Yayınlandı" ? now : null;
  await db.prepare(`UPDATE social_posts
    SET status = ?, published_at = ?, publish_lock_token = NULL, publish_lock_expires_at = NULL, updated_at = ?
    WHERE id = ?`)
    .bind(status, publishedAt, now, id).run();
  return fetchSocialPost(db, id);
}

export async function deleteSocialPost(id: string): Promise<boolean> {
  const db = await database();
  await ensureTable(db);
  const result = await db.prepare("DELETE FROM social_posts WHERE id = ?").bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}
