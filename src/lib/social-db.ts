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
  created_at: string;
  updated_at: string;
};

type SocialPostIdentityRow = Pick<SocialPostRow, "villa" | "platform" | "content_type" | "scheduled_date" | "caption">;

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function identity(input: Pick<SocialPostInput, "villa" | "platform" | "contentType" | "scheduledDate" | "caption">) {
  return `${input.villa}\u001f${input.platform}\u001f${input.contentType}\u001f${input.scheduledDate}\u001f${input.caption}`;
}

async function ensureTable(db: D1Database) {
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS social_posts_schedule_idx ON social_posts (status, scheduled_date)"),
  ]);
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN media_url TEXT NOT NULL DEFAULT ''").run(); } catch {}
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'İnsan onayı' CHECK (approval_status IN ('İnsan onayı', 'Onaylandı'))").run(); } catch {}
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN approved_at TEXT").run(); } catch {}
}

export async function listSocialPosts(): Promise<SocialPost[]> {
  const db = await database();
  await ensureTable(db);
  const result = await db.prepare(`SELECT * FROM social_posts
    ORDER BY CASE status WHEN 'Planlandı' THEN 0 ELSE 1 END, scheduled_date ASC, created_at DESC`).all<SocialPostRow>();
  return result.results.map(mapRow);
}

export async function getSocialPost(id: string): Promise<SocialPost | null> {
  const db = await database();
  await ensureTable(db);
  const row = await db.prepare("SELECT * FROM social_posts WHERE id = ?").bind(id).first<SocialPostRow>();
  return row ? mapRow(row) : null;
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
    createdAt: now,
    updatedAt: now,
  };
  await db.prepare(`INSERT INTO social_posts
    (id, villa, platform, content_type, scheduled_date, caption, media_url, status, approval_status, approved_at, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      post.id, post.villa, post.platform, post.contentType, post.scheduledDate, post.caption, post.mediaUrl,
      post.status, post.approvalStatus, post.approvedAt, post.publishedAt, post.createdAt, post.updatedAt,
    ).run();
  return post;
}

export async function seedSocialPosts(inputs: SocialPostInput[]) {
  const db = await database();
  await ensureTable(db);
  const existingRows = await db.prepare("SELECT villa, platform, content_type, scheduled_date, caption FROM social_posts").all<SocialPostIdentityRow>();
  const existing = new Set(existingRows.results.map((row) => identity({
    villa: row.villa,
    platform: row.platform,
    contentType: row.content_type,
    scheduledDate: row.scheduled_date,
    caption: row.caption,
  })));

  const pending = inputs.filter((input) => !existing.has(identity(input)));
  const now = new Date().toISOString();
  const statements = pending.map((input) => db.prepare(`INSERT INTO social_posts
    (id, villa, platform, content_type, scheduled_date, caption, media_url, status, approval_status, approved_at, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Planlandı', 'İnsan onayı', NULL, NULL, ?, ?)`)
    .bind(crypto.randomUUID(), input.villa, input.platform, input.contentType, input.scheduledDate, input.caption, input.mediaUrl, now, now));

  for (let index = 0; index < statements.length; index += 50) {
    await db.batch(statements.slice(index, index + 50));
  }

  return { created: pending.length, skipped: inputs.length - pending.length, total: inputs.length };
}

export async function updateSocialPostApproval(id: string, approvalStatus: SocialPostApproval): Promise<SocialPost | null> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  const approvedAt = approvalStatus === "Onaylandı" ? now : null;
  await db.prepare("UPDATE social_posts SET approval_status = ?, approved_at = ?, updated_at = ? WHERE id = ?")
    .bind(approvalStatus, approvedAt, now, id).run();
  const row = await db.prepare("SELECT * FROM social_posts WHERE id = ?").bind(id).first<SocialPostRow>();
  return row ? mapRow(row) : null;
}

export async function updateSocialPostStatus(id: string, status: SocialPostStatus): Promise<SocialPost | null> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  const publishedAt = status === "Yayınlandı" ? now : null;
  await db.prepare("UPDATE social_posts SET status = ?, published_at = ?, updated_at = ? WHERE id = ?")
    .bind(status, publishedAt, now, id).run();
  const row = await db.prepare("SELECT * FROM social_posts WHERE id = ?").bind(id).first<SocialPostRow>();
  return row ? mapRow(row) : null;
}

export async function deleteSocialPost(id: string): Promise<boolean> {
  const db = await database();
  await ensureTable(db);
  const result = await db.prepare("DELETE FROM social_posts WHERE id = ?").bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}
