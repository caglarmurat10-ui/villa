import {
  isRetryableInstagramError,
  publishInstagramPost,
  safeInstagramError,
} from "@/lib/instagramPublish";
import {
  ensureInstagramPublishLogTables,
  instagramPublishLogStatements,
  writeInstagramPublishLog,
} from "@/lib/instagramPublishLog";
import { validateManagedInstagramMedia } from "@/lib/instagramMedia";
import {
  INSTAGRAM_TIMEZONE,
  validateScheduledDate,
} from "@/lib/instagramTime";
import {
  isInstagramPublishType,
  isVilla,
  validateInstagramPublishInput,
  type InstagramPublishInput,
  type InstagramPublishType,
} from "@/lib/instagramTypes";
import type { Villa } from "@/lib/types";
import type { D1Database } from "@cloudflare/workers-types";

export const MAX_SCHEDULE_ATTEMPTS = 3;
export const SCHEDULER_BATCH_SIZE = 3;
export const STALE_PROCESSING_MS = 15 * 60 * 1000;
const RETRY_DELAYS_MS = [5 * 60 * 1000, 15 * 60 * 1000] as const;

export type ScheduledPostStatus =
  | "scheduled"
  | "processing"
  | "published"
  | "failed"
  | "cancelled";

export type ScheduledInstagramPost = {
  id: string;
  villa: Villa;
  type: InstagramPublishType;
  caption: string;
  mediaUrls: string[];
  shareToFeed: boolean;
  scheduledAt: string;
  timezone: typeof INSTAGRAM_TIMEZONE;
  status: ScheduledPostStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  instagramMediaId: string | null;
  attemptCount: number;
  lastError: string | null;
  lockedAt: string | null;
  mediaCount: number;
  nextAttemptAt: string | null;
  publishStartedAt: string | null;
};

type ScheduledInstagramPostRow = {
  id: string;
  villa: Villa;
  type: InstagramPublishType;
  caption: string;
  media_urls: string;
  share_to_feed: number;
  scheduled_at: string;
  timezone: string;
  status: ScheduledPostStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  instagram_media_id: string | null;
  attempt_count: number;
  last_error: string | null;
  locked_at: string | null;
  media_count: number;
  next_attempt_at: string | null;
  publish_started_at: string | null;
};

export type CreateScheduledPostInput = InstagramPublishInput & {
  scheduledAt: Date;
  timezone: typeof INSTAGRAM_TIMEZONE;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMediaUrls(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.every((item): item is string => typeof item === "string")
    ) {
      return parsed;
    }
  } catch {
    // Bozuk kayıt dışarıya sızdırılmadan boş diziye çevrilir.
  }
  return [];
}

function mapScheduledPost(
  row: ScheduledInstagramPostRow,
): ScheduledInstagramPost {
  return {
    id: row.id,
    villa: row.villa,
    type: row.type,
    caption: row.caption,
    mediaUrls: parseMediaUrls(row.media_urls),
    shareToFeed: row.share_to_feed === 1,
    scheduledAt: row.scheduled_at,
    timezone: INSTAGRAM_TIMEZONE,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    instagramMediaId: row.instagram_media_id,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    lockedAt: row.locked_at,
    mediaCount: row.media_count,
    nextAttemptAt: row.next_attempt_at,
    publishStartedAt: row.publish_started_at,
  };
}

function safeSchedulerError(error: unknown) {
  return safeInstagramError(error, "Planlı Instagram yayını tamamlanamadı.");
}

export function parseScheduleRequestBody(
  value: unknown,
  now = new Date(),
): CreateScheduledPostInput {
  if (!isRecord(value)) throw new Error("Planlama isteği geçersiz.");
  if (!isVilla(value.villa)) throw new Error("Geçerli villa seçin.");
  if (!isInstagramPublishType(value.type)) {
    throw new Error("Yayın türü geçersiz.");
  }
  if (
    !Array.isArray(value.mediaUrls) ||
    !value.mediaUrls.every((item): item is string => typeof item === "string")
  ) {
    throw new Error("Medya adresleri geçersiz.");
  }
  if (typeof value.caption !== "string") {
    throw new Error("Paylaşım metni geçersiz.");
  }
  if (
    value.shareToFeed !== undefined &&
    typeof value.shareToFeed !== "boolean"
  ) {
    throw new Error("Akışta göster seçimi geçersiz.");
  }
  if (typeof value.scheduledAt !== "string") {
    throw new Error("Planlama tarihi ve saati gerekli.");
  }
  if (value.timezone !== INSTAGRAM_TIMEZONE) {
    throw new Error("Planlama saat dilimi Europe/Istanbul olmalı.");
  }

  const input: InstagramPublishInput = {
    villa: value.villa,
    type: value.type,
    mediaUrls: value.mediaUrls.map((item) => item.trim()),
    caption: value.caption.trim(),
    shareToFeed: value.shareToFeed !== false,
  };
  validateInstagramPublishInput(input, { captionRequired: false });

  return {
    ...input,
    scheduledAt: validateScheduledDate(value.scheduledAt, value.timezone, now),
    timezone: INSTAGRAM_TIMEZONE,
  };
}

export async function ensureInstagramScheduledPostsTable(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS instagram_scheduled_posts (
        id TEXT PRIMARY KEY,
        villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
        type TEXT NOT NULL CHECK (type IN ('IMAGE', 'CAROUSEL', 'REELS')),
        caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 2200),
        media_urls TEXT NOT NULL,
        share_to_feed INTEGER NOT NULL DEFAULT 1 CHECK (share_to_feed IN (0, 1)),
        scheduled_at TEXT NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
        status TEXT NOT NULL DEFAULT 'scheduled'
          CHECK (status IN ('scheduled', 'processing', 'published', 'failed', 'cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT,
        instagram_media_id TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        last_error TEXT,
        locked_at TEXT,
        media_count INTEGER NOT NULL CHECK (media_count BETWEEN 1 AND 10),
        next_attempt_at TEXT,
        publish_started_at TEXT
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS instagram_scheduled_due_idx
      ON instagram_scheduled_posts (status, next_attempt_at, scheduled_at)
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS instagram_scheduled_locked_idx
      ON instagram_scheduled_posts (status, locked_at)
    `),
  ]);
}

export async function createScheduledInstagramPost(
  db: D1Database,
  input: CreateScheduledPostInput,
) {
  await ensureInstagramScheduledPostsTable(db);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db
    .prepare(`
      INSERT INTO instagram_scheduled_posts
        (id, villa, type, caption, media_urls, share_to_feed, scheduled_at,
         timezone, status, created_at, updated_at, media_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
    `)
    .bind(
      id,
      input.villa,
      input.type,
      input.caption,
      JSON.stringify(input.mediaUrls),
      input.shareToFeed ? 1 : 0,
      input.scheduledAt.toISOString(),
      input.timezone,
      now,
      now,
      input.mediaUrls.length,
    )
    .run();
  return getScheduledInstagramPost(db, id);
}

export async function getScheduledInstagramPost(
  db: D1Database,
  id: string,
) {
  await ensureInstagramScheduledPostsTable(db);
  const row = await db
    .prepare("SELECT * FROM instagram_scheduled_posts WHERE id = ?")
    .bind(id)
    .first<ScheduledInstagramPostRow>();
  return row ? mapScheduledPost(row) : null;
}

export async function listScheduledInstagramPosts(db: D1Database) {
  await ensureInstagramScheduledPostsTable(db);
  const result = await db
    .prepare(`
      SELECT * FROM instagram_scheduled_posts
      ORDER BY
        CASE status
          WHEN 'processing' THEN 0
          WHEN 'scheduled' THEN 1
          WHEN 'failed' THEN 2
          WHEN 'published' THEN 3
          ELSE 4
        END,
        scheduled_at ASC,
        created_at DESC
      LIMIT 100
    `)
    .all<ScheduledInstagramPostRow>();
  return result.results.map(mapScheduledPost);
}

export async function updateScheduledInstagramPost(
  db: D1Database,
  id: string,
  input: { caption: string; scheduledAt: Date; timezone: string },
) {
  if (input.caption.length > 2200) {
    throw new Error("Paylaşım metni en fazla 2200 karakter olabilir.");
  }
  if (input.timezone !== INSTAGRAM_TIMEZONE) {
    throw new Error("Planlama saat dilimi Europe/Istanbul olmalı.");
  }
  const now = new Date().toISOString();
  await ensureInstagramScheduledPostsTable(db);
  const result = await db
    .prepare(`
      UPDATE instagram_scheduled_posts
      SET caption = ?, scheduled_at = ?, timezone = ?, status = 'scheduled',
          updated_at = ?, last_error = NULL, next_attempt_at = NULL,
          locked_at = NULL, publish_started_at = NULL, attempt_count = 0,
          instagram_media_id = NULL, published_at = NULL
      WHERE id = ? AND status IN ('scheduled', 'failed')
    `)
    .bind(
      input.caption.trim(),
      input.scheduledAt.toISOString(),
      input.timezone,
      now,
      id,
    )
    .run();
  return (result.meta.changes ?? 0) === 1
    ? getScheduledInstagramPost(db, id)
    : null;
}

export async function cancelScheduledInstagramPost(
  db: D1Database,
  id: string,
) {
  await ensureInstagramScheduledPostsTable(db);
  const result = await db
    .prepare(`
      UPDATE instagram_scheduled_posts
      SET status = 'cancelled', updated_at = ?, locked_at = NULL,
          next_attempt_at = NULL
      WHERE id = ? AND status IN ('scheduled', 'failed')
    `)
    .bind(new Date().toISOString(), id)
    .run();
  return (result.meta.changes ?? 0) === 1;
}

async function listDuePosts(db: D1Database, now: Date) {
  const result = await db
    .prepare(`
      SELECT * FROM instagram_scheduled_posts
      WHERE status = 'scheduled'
        AND COALESCE(next_attempt_at, scheduled_at) <= ?
      ORDER BY COALESCE(next_attempt_at, scheduled_at) ASC
      LIMIT ?
    `)
    .bind(now.toISOString(), SCHEDULER_BATCH_SIZE)
    .all<ScheduledInstagramPostRow>();
  return result.results.map(mapScheduledPost);
}

export async function claimScheduledInstagramPost(
  db: D1Database,
  post: ScheduledInstagramPost,
  now: Date,
) {
  const timestamp = now.toISOString();
  const result = await db
    .prepare(`
      UPDATE instagram_scheduled_posts
      SET status = 'processing', locked_at = ?, updated_at = ?,
          attempt_count = attempt_count + 1, last_error = NULL
      WHERE id = ? AND status = 'scheduled'
        AND COALESCE(next_attempt_at, scheduled_at) <= ?
    `)
    .bind(timestamp, timestamp, post.id, timestamp)
    .run();
  if ((result.meta.changes ?? 0) !== 1) return null;
  return getScheduledInstagramPost(db, post.id);
}

async function markPublishStarted(
  db: D1Database,
  postId: string,
  now: Date,
) {
  const result = await db
    .prepare(`
      UPDATE instagram_scheduled_posts
      SET publish_started_at = ?, updated_at = ?
      WHERE id = ? AND status = 'processing' AND instagram_media_id IS NULL
    `)
    .bind(now.toISOString(), now.toISOString(), postId)
    .run();
  if ((result.meta.changes ?? 0) !== 1) {
    throw new Error("Planlı yayın kilidi kaybedildi.");
  }
}

async function storePublishedMediaId(
  db: D1Database,
  postId: string,
  mediaId: string,
  now: Date,
) {
  const result = await db
    .prepare(`
      UPDATE instagram_scheduled_posts
      SET instagram_media_id = ?, updated_at = ?
      WHERE id = ? AND status = 'processing'
    `)
    .bind(mediaId, now.toISOString(), postId)
    .run();
  if ((result.meta.changes ?? 0) !== 1) {
    throw new Error("Instagram medya kimliği güvenli biçimde kaydedilemedi.");
  }
}

export function scheduledRetryDecision(
  retryable: boolean,
  attemptCount: number,
  now = new Date(),
) {
  if (!retryable || attemptCount >= MAX_SCHEDULE_ATTEMPTS) {
    return { status: "failed" as const, nextAttemptAt: null };
  }
  const delay = RETRY_DELAYS_MS[Math.max(0, attemptCount - 1)];
  if (!delay) return { status: "failed" as const, nextAttemptAt: null };
  return {
    status: "scheduled" as const,
    nextAttemptAt: new Date(now.getTime() + delay).toISOString(),
  };
}

async function markScheduledFailure(
  db: D1Database,
  post: ScheduledInstagramPost,
  error: unknown,
  now: Date,
  forcePermanent = false,
) {
  const message = safeSchedulerError(error);
  const decision = scheduledRetryDecision(
    !forcePermanent && isRetryableInstagramError(error),
    post.attemptCount,
    now,
  );
  const update = await db
    .prepare(`
      UPDATE instagram_scheduled_posts
      SET status = ?, next_attempt_at = ?, last_error = ?, updated_at = ?,
          locked_at = NULL, publish_started_at = NULL
      WHERE id = ? AND status = 'processing'
    `)
    .bind(
      decision.status,
      decision.nextAttemptAt,
      message,
      now.toISOString(),
      post.id,
    )
    .run();

  if ((update.meta.changes ?? 0) === 1 && decision.status === "failed") {
    await writeInstagramPublishLog(db, {
      villa: post.villa,
      username: null,
      mediaUrls: post.mediaUrls,
      publishType: post.type,
      source: "scheduled",
      caption: post.caption,
      status: "Hata",
      error: message,
    });
  }
}

async function finalizeScheduledSuccess(
  db: D1Database,
  post: ScheduledInstagramPost,
  mediaId: string,
  username: string | null,
  now: Date,
) {
  await ensureInstagramPublishLogTables(db);
  const timestamp = now.toISOString();
  const logId = crypto.randomUUID();
  const results = await db.batch([
    db
      .prepare(`
        UPDATE instagram_scheduled_posts
        SET status = 'published', published_at = ?, instagram_media_id = ?,
            updated_at = ?, locked_at = NULL, next_attempt_at = NULL,
            last_error = NULL
        WHERE id = ? AND status = 'processing'
      `)
      .bind(timestamp, mediaId, timestamp, post.id),
    ...instagramPublishLogStatements(
      db,
      {
        villa: post.villa,
        username,
        mediaUrls: post.mediaUrls,
        publishType: post.type,
        source: "scheduled",
        caption: post.caption,
        mediaId,
        status: "Yayınlandı",
      },
      logId,
      timestamp,
    ),
  ]);
  if ((results[0].meta.changes ?? 0) !== 1) {
    throw new Error("Planlı yayın sonucu kaydedilemedi.");
  }
}

export type StaleProcessingAction =
  | "publish-confirmed"
  | "ambiguous-failed"
  | "retry"
  | "failed";

export function staleProcessingAction(
  post: Pick<
    ScheduledInstagramPost,
    "instagramMediaId" | "publishStartedAt" | "attemptCount"
  >,
): StaleProcessingAction {
  if (post.instagramMediaId) return "publish-confirmed";
  if (post.publishStartedAt) return "ambiguous-failed";
  return post.attemptCount < MAX_SCHEDULE_ATTEMPTS ? "retry" : "failed";
}

async function recoverStaleProcessing(db: D1Database, now: Date) {
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS).toISOString();
  const result = await db
    .prepare(`
      SELECT * FROM instagram_scheduled_posts
      WHERE status = 'processing' AND locked_at <= ?
      ORDER BY locked_at ASC
      LIMIT 20
    `)
    .bind(staleBefore)
    .all<ScheduledInstagramPostRow>();

  for (const row of result.results) {
    const recoveryLock = await db
      .prepare(`
        UPDATE instagram_scheduled_posts
        SET locked_at = ?, updated_at = ?
        WHERE id = ? AND status = 'processing' AND locked_at <= ?
      `)
      .bind(now.toISOString(), now.toISOString(), row.id, staleBefore)
      .run();
    if ((recoveryLock.meta.changes ?? 0) !== 1) continue;

    const post = mapScheduledPost({
      ...row,
      locked_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    const action = staleProcessingAction(post);
    if (action === "publish-confirmed" && post.instagramMediaId) {
      await finalizeScheduledSuccess(
        db,
        post,
        post.instagramMediaId,
        null,
        now,
      );
      continue;
    }
    if (action === "ambiguous-failed") {
      await markScheduledFailure(
        db,
        post,
        new Error(
          "Instagram yayın sonucu belirsiz kaldığı için çift paylaşımı önlemek üzere otomatik tekrar durduruldu.",
        ),
        now,
        true,
      );
      continue;
    }
    if (action === "retry") {
      await db
        .prepare(`
          UPDATE instagram_scheduled_posts
          SET status = 'scheduled', next_attempt_at = ?, locked_at = NULL,
              updated_at = ?, last_error = ?
          WHERE id = ? AND status = 'processing' AND locked_at = ?
        `)
        .bind(
          now.toISOString(),
          now.toISOString(),
          "Kesilen işlem güvenli biçimde yeniden kuyruğa alındı.",
          post.id,
          post.lockedAt,
        )
        .run();
      continue;
    }
    await markScheduledFailure(
      db,
      post,
      new Error("Planlı yayın en fazla 3 otomatik denemeden sonra durduruldu."),
      now,
      true,
    );
  }
}

async function processClaimedPost(
  env: CloudflareEnv,
  post: ScheduledInstagramPost,
) {
  let finalPublishStarted = false;
  try {
    const input: InstagramPublishInput = {
      villa: post.villa,
      type: post.type,
      mediaUrls: post.mediaUrls,
      caption: post.caption,
      shareToFeed: post.shareToFeed,
    };
    validateInstagramPublishInput(input, { captionRequired: false });
    await validateManagedInstagramMedia(env, input);
    const result = await publishInstagramPost(env, input, {
      beforeFinalPublish: async () => {
        await markPublishStarted(env.DB, post.id, new Date());
        finalPublishStarted = true;
      },
      afterExternalPublish: async (mediaId) => {
        await storePublishedMediaId(env.DB, post.id, mediaId, new Date());
      },
    });
    await finalizeScheduledSuccess(
      env.DB,
      post,
      result.instagramMediaId,
      result.username,
      new Date(),
    );
  } catch (error) {
    if (finalPublishStarted) {
      const current = await getScheduledInstagramPost(env.DB, post.id);
      if (current?.status === "published") return;
      if (current?.instagramMediaId) {
        await finalizeScheduledSuccess(
          env.DB,
          current,
          current.instagramMediaId,
          null,
          new Date(),
        );
        return;
      }
      await markScheduledFailure(env.DB, post, error, new Date(), true);
      return;
    }
    await markScheduledFailure(env.DB, post, error, new Date());
  }
}

export type SchedulerDependencies = {
  recover: (now: Date) => Promise<void>;
  listDue: (now: Date) => Promise<ScheduledInstagramPost[]>;
  claim: (
    post: ScheduledInstagramPost,
    now: Date,
  ) => Promise<ScheduledInstagramPost | null>;
  process: (post: ScheduledInstagramPost, now: Date) => Promise<void>;
};

export async function processScheduledQueue(
  dependencies: SchedulerDependencies,
  now = new Date(),
) {
  await dependencies.recover(now);
  const due = await dependencies.listDue(now);
  let claimed = 0;
  for (const post of due.slice(0, SCHEDULER_BATCH_SIZE)) {
    if (post.status !== "scheduled") continue;
    const owned = await dependencies.claim(post, now);
    if (!owned) continue;
    claimed += 1;
    await dependencies.process(owned, now);
  }
  return { due: due.length, claimed };
}

export async function runInstagramScheduler(
  env: CloudflareEnv,
  now = new Date(),
) {
  await ensureInstagramScheduledPostsTable(env.DB);
  return processScheduledQueue(
    {
      recover: (current) => recoverStaleProcessing(env.DB, current),
      listDue: (current) => listDuePosts(env.DB, current),
      claim: (post, current) =>
        claimScheduledInstagramPost(env.DB, post, current),
      process: (post) => processClaimedPost(env, post),
    },
    now,
  );
}
