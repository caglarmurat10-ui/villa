import type { InstagramPublishType } from "@/lib/instagramTypes";
import type { Villa } from "@/lib/types";
import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";

export type InstagramPublishSource = "manual" | "scheduled";

export type InstagramPublishLogInput = {
  villa: Villa;
  username: string | null;
  mediaUrls: string[];
  publishType: InstagramPublishType;
  source: InstagramPublishSource;
  caption: string;
  mediaId?: string | null;
  status: "Yayınlandı" | "Hata";
  error?: string | null;
};

export async function ensureInstagramPublishLogTables(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS instagram_publish_log (
        id TEXT PRIMARY KEY,
        villa TEXT NOT NULL,
        username TEXT,
        image_url TEXT NOT NULL,
        caption TEXT NOT NULL,
        instagram_media_id TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        published_at TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS instagram_publish_log_details (
        log_id TEXT PRIMARY KEY,
        publish_type TEXT NOT NULL
          CHECK (publish_type IN ('IMAGE', 'CAROUSEL', 'REELS')),
        item_count INTEGER NOT NULL CHECK (item_count BETWEEN 1 AND 10),
        FOREIGN KEY (log_id) REFERENCES instagram_publish_log(id) ON DELETE CASCADE
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS instagram_publish_log_sources (
        log_id TEXT PRIMARY KEY,
        source TEXT NOT NULL CHECK (source IN ('manual', 'scheduled')),
        FOREIGN KEY (log_id) REFERENCES instagram_publish_log(id) ON DELETE CASCADE
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS instagram_publish_log_created_idx
      ON instagram_publish_log (created_at DESC)
    `),
  ]);
}

export function instagramPublishLogStatements(
  db: D1Database,
  input: InstagramPublishLogInput,
  logId: string,
  now: string,
): D1PreparedStatement[] {
  return [
    db
      .prepare(`
        INSERT INTO instagram_publish_log
          (id, villa, username, image_url, caption, instagram_media_id,
           status, error_message, created_at, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        logId,
        input.villa,
        input.username,
        input.mediaUrls[0],
        input.caption,
        input.mediaId ?? null,
        input.status,
        input.error ?? null,
        now,
        input.status === "Yayınlandı" ? now : null,
      ),
    db
      .prepare(`
        INSERT INTO instagram_publish_log_details
          (log_id, publish_type, item_count)
        VALUES (?, ?, ?)
      `)
      .bind(logId, input.publishType, input.mediaUrls.length),
    db
      .prepare(`
        INSERT INTO instagram_publish_log_sources (log_id, source)
        VALUES (?, ?)
      `)
      .bind(logId, input.source),
  ];
}

export async function writeInstagramPublishLog(
  db: D1Database,
  input: InstagramPublishLogInput,
) {
  await ensureInstagramPublishLogTables(db);
  const now = new Date().toISOString();
  await db.batch(
    instagramPublishLogStatements(db, input, crypto.randomUUID(), now),
  );
}

export async function listInstagramPublishLogs(db: D1Database) {
  await ensureInstagramPublishLogTables(db);
  const result = await db
    .prepare(`
      SELECT log.id, log.villa, log.username, log.image_url AS imageUrl,
             log.caption, log.instagram_media_id AS instagramMediaId,
             log.status, log.error_message AS errorMessage,
             log.created_at AS createdAt, log.published_at AS publishedAt,
             COALESCE(details.publish_type, 'IMAGE') AS publishType,
             COALESCE(details.item_count, 1) AS itemCount,
             COALESCE(sources.source, 'manual') AS source
      FROM instagram_publish_log AS log
      LEFT JOIN instagram_publish_log_details AS details
        ON details.log_id = log.id
      LEFT JOIN instagram_publish_log_sources AS sources
        ON sources.log_id = log.id
      ORDER BY log.created_at DESC
      LIMIT 30
    `)
    .all();
  return result.results;
}
