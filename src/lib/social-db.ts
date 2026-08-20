import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { SocialPost, SocialPostStatus } from "./types";
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
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

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
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS social_posts_schedule_idx ON social_posts (status, scheduled_date)"),
  ]);
  try { await db.prepare("ALTER TABLE social_posts ADD COLUMN media_url TEXT NOT NULL DEFAULT ''").run(); } catch {}
}

export async function listSocialPosts(): Promise<SocialPost[]> {
  const db = await database();
  await ensureTable(db);
  const result = await db.prepare(`SELECT * FROM social_posts
    ORDER BY CASE status WHEN 'Planlandı' THEN 0 ELSE 1 END, scheduled_date ASC, created_at DESC`).all<SocialPostRow>();
  return result.results.map(mapRow);
}

export async function createSocialPost(input: SocialPostInput): Promise<SocialPost> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  const post: SocialPost = {
    id: crypto.randomUUID(),
    ...input,
    status: "Planlandı",
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.prepare(`INSERT INTO social_posts
    (id, villa, platform, content_type, scheduled_date, caption, media_url, status, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      post.id, post.villa, post.platform, post.contentType, post.scheduledDate, post.caption, post.mediaUrl,
      post.status, post.publishedAt, post.createdAt, post.updatedAt,
    ).run();
  return post;
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
