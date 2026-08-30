import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

export type SocialMediaKind = "image" | "video";
export type SocialPostMediaItem = {
  position: number;
  mediaUrl: string;
  kind: SocialMediaKind;
};

let ready: Promise<void> | null = null;

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

async function ensure(db: D1Database) {
  if (!ready) {
    ready = db.prepare(`CREATE TABLE IF NOT EXISTS social_post_media (
      post_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      media_url TEXT NOT NULL,
      media_kind TEXT NOT NULL CHECK (media_kind IN ('image','video')),
      created_at TEXT NOT NULL,
      PRIMARY KEY (post_id, position)
    )`).run().then(async () => {
      await db.prepare("CREATE INDEX IF NOT EXISTS social_post_media_post_idx ON social_post_media(post_id, position)").run();
    }).catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
}

export async function listSocialPostMedia(postId: string): Promise<SocialPostMediaItem[]> {
  const db = await database();
  await ensure(db);
  const result = await db.prepare(`SELECT position, media_url, media_kind
    FROM social_post_media WHERE post_id = ? ORDER BY position ASC`)
    .bind(postId)
    .all<{ position: number; media_url: string; media_kind: SocialMediaKind }>();
  return result.results.map((row) => ({ position: row.position, mediaUrl: row.media_url, kind: row.media_kind }));
}

export async function replaceSocialPostMedia(postId: string, items: Array<{ mediaUrl: string; kind: SocialMediaKind }>) {
  const db = await database();
  await ensure(db);
  const now = new Date().toISOString();
  const statements = [db.prepare("DELETE FROM social_post_media WHERE post_id = ?").bind(postId)];
  for (let position = 0; position < items.length; position += 1) {
    const item = items[position];
    statements.push(db.prepare(`INSERT INTO social_post_media(post_id, position, media_url, media_kind, created_at)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(postId, position, item.mediaUrl, item.kind, now));
  }
  await db.batch(statements);
  return listSocialPostMedia(postId);
}

export async function deleteSocialPostMedia(postId: string) {
  const db = await database();
  await ensure(db);
  await db.prepare("DELETE FROM social_post_media WHERE post_id = ?").bind(postId).run();
}
