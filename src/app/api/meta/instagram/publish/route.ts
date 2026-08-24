import {
  createInstagramContainer,
  publishInstagramContainer,
  resolveInstagramConnection,
  safeInstagramError,
  waitForInstagramContainer,
  type InstagramConnection,
} from "@/lib/instagramPublish";
import { INSTAGRAM_MEDIA_PREFIX } from "@/lib/instagramTokenStore";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";

function isVilla(value: string): value is Villa {
  return value === "Destan" || value === "Safira";
}

type PublishType = "IMAGE" | "CAROUSEL" | "REELS";

type PublishRequest = {
  villa: Villa;
  type: PublishType;
  mediaUrls: string[];
  caption: string;
  shareToFeed: boolean;
  legacyImageRequest: boolean;
};

type MediaMetadata = {
  contentType?: unknown;
  size?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublishType(value: unknown): value is PublishType {
  return value === "IMAGE" || value === "CAROUSEL" || value === "REELS";
}

function httpsUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      value.length <= 2048
    );
  } catch {
    return false;
  }
}

function parsePublishRequest(value: unknown): PublishRequest {
  if (!isRecord(value)) throw new Error("Yayın isteği geçersiz.");

  const requestedVilla =
    typeof value.villa === "string" ? value.villa.trim() : "";
  if (!isVilla(requestedVilla)) throw new Error("Geçerli villa seçin.");

  const caption = typeof value.caption === "string" ? value.caption.trim() : "";
  if (!caption || caption.length > 2200) {
    throw new Error("Paylaşım metni 1-2200 karakter arasında olmalı.");
  }

  let type: PublishType;
  let mediaUrls: string[];
  let legacyImageRequest = false;

  if (isPublishType(value.type)) {
    type = value.type;
    if (
      !Array.isArray(value.mediaUrls) ||
      !value.mediaUrls.every((item): item is string => typeof item === "string")
    ) {
      throw new Error("Medya adresleri geçersiz.");
    }
    mediaUrls = value.mediaUrls.map((item) => item.trim());
  } else if (typeof value.imageUrl === "string") {
    type = "IMAGE";
    mediaUrls = [value.imageUrl.trim()];
    legacyImageRequest = true;
  } else {
    throw new Error("Yayın türü veya medya adresi eksik.");
  }

  if (type === "IMAGE" && mediaUrls.length !== 1) {
    throw new Error("Tek fotoğraf yayını için tam 1 JPEG gerekli.");
  }
  if (type === "CAROUSEL" && (mediaUrls.length < 2 || mediaUrls.length > 10)) {
    throw new Error("Carousel yayını 2-10 JPEG içermeli.");
  }
  if (type === "REELS" && mediaUrls.length !== 1) {
    throw new Error("Reels yayını için tam 1 MP4 gerekli.");
  }
  if (!mediaUrls.every(httpsUrl)) {
    throw new Error("Instagram için geçerli HTTPS medya adresleri gerekli.");
  }

  if (value.shareToFeed !== undefined && typeof value.shareToFeed !== "boolean") {
    throw new Error("Akışta göster seçimi geçersiz.");
  }

  return {
    villa: requestedVilla,
    type,
    mediaUrls,
    caption,
    shareToFeed: value.shareToFeed !== false,
    legacyImageRequest,
  };
}

function managedMediaKey(mediaUrl: string, appBaseUrl: string) {
  const url = new URL(mediaUrl);
  const appUrl = new URL(appBaseUrl);
  const routePrefix = "/api/meta/instagram/media/";

  if (url.origin !== appUrl.origin || !url.pathname.startsWith(routePrefix)) {
    return null;
  }

  try {
    const key = url.pathname
      .slice(routePrefix.length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
    if (!key.startsWith(INSTAGRAM_MEDIA_PREFIX) || key.includes("..")) {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}

async function validateManagedMedia(
  env: CloudflareEnv,
  request: PublishRequest,
) {
  const expectedContentType =
    request.type === "REELS" ? "video/mp4" : "image/jpeg";
  const maxBytes =
    request.type === "REELS" ? 24 * 1024 * 1024 : 8 * 1024 * 1024;

  for (const mediaUrl of request.mediaUrls) {
    const key = managedMediaKey(mediaUrl, env.APP_BASE_URL);
    if (!key) {
      throw new Error("Medya önce güvenli yayın yükleme alanına yüklenmeli.");
    }

    const object = await env.SOCIAL_MEDIA_KV.getWithMetadata<MediaMetadata>(
      key,
      "stream",
    );
    if (!object.value) throw new Error("Yüklenen medya bulunamadı veya süresi doldu.");
    await object.value.cancel();

    const contentType = object.metadata?.contentType;
    const size = object.metadata?.size;
    if (contentType !== expectedContentType) {
      throw new Error(
        request.type === "REELS"
          ? "Reels yayını için MP4 video gerekli."
          : "Fotoğraf yayınları için JPEG/JPG gerekli.",
      );
    }
    if (typeof size !== "number" || size <= 0 || size > maxBytes) {
      throw new Error(
        request.type === "REELS"
          ? "Reels dosyası 24 MiB veya daha küçük olmalı."
          : "JPEG dosyası 8 MiB veya daha küçük olmalı.",
      );
    }
  }
}

async function publishImage(
  connection: InstagramConnection,
  mediaUrl: string,
  caption: string,
) {
  const containerId = await createInstagramContainer(
    connection,
    { image_url: mediaUrl, caption },
    "Instagram medya kapsayıcısı oluşturulamadı",
  );
  await waitForInstagramContainer(
    connection,
    containerId,
    "IMAGE",
    "Instagram fotoğrafı",
  );
  return publishInstagramContainer(connection, containerId);
}

async function publishCarousel(
  connection: InstagramConnection,
  mediaUrls: string[],
  caption: string,
) {
  const childIds: string[] = [];

  for (let index = 0; index < mediaUrls.length; index += 1) {
    try {
      const childId = await createInstagramContainer(
        connection,
        { image_url: mediaUrls[index], is_carousel_item: "true" },
        `Carousel ${index + 1}. öğe kapsayıcısı oluşturulamadı`,
      );
      await waitForInstagramContainer(
        connection,
        childId,
        "IMAGE",
        `Carousel ${index + 1}. öğesi`,
      );
      childIds.push(childId);
    } catch (error) {
      throw new Error(
        `Carousel ${index + 1}. öğesi hazırlanamadı: ${safeInstagramError(
          error,
          "Instagram medya hazırlığı başarısız.",
        )}`,
      );
    }
  }

  const parentId = await createInstagramContainer(
    connection,
    {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
    },
    "Instagram Carousel kapsayıcısı oluşturulamadı",
  );
  await waitForInstagramContainer(
    connection,
    parentId,
    "IMAGE",
    "Instagram Carousel",
  );
  return publishInstagramContainer(connection, parentId);
}

async function publishReels(
  connection: InstagramConnection,
  mediaUrl: string,
  caption: string,
  shareToFeed: boolean,
) {
  const containerId = await createInstagramContainer(
    connection,
    {
      media_type: "REELS",
      video_url: mediaUrl,
      caption,
      share_to_feed: String(shareToFeed),
    },
    "Instagram Reels kapsayıcısı oluşturulamadı",
  );
  await waitForInstagramContainer(
    connection,
    containerId,
    "REELS",
    "Instagram Reels videosu",
  );
  return publishInstagramContainer(connection, containerId);
}

async function publishByType(
  connection: InstagramConnection,
  request: PublishRequest,
) {
  if (request.type === "CAROUSEL") {
    return publishCarousel(connection, request.mediaUrls, request.caption);
  }
  if (request.type === "REELS") {
    return publishReels(
      connection,
      request.mediaUrls[0],
      request.caption,
      request.shareToFeed,
    );
  }
  return publishImage(connection, request.mediaUrls[0], request.caption);
}

async function ensureLogTable(db: D1Database) {
  await db
    .prepare(`
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
    `)
    .run();

  await db
    .prepare(`
      CREATE TABLE IF NOT EXISTS instagram_publish_log_details (
        log_id TEXT PRIMARY KEY,
        publish_type TEXT NOT NULL
          CHECK (publish_type IN ('IMAGE', 'CAROUSEL', 'REELS')),
        item_count INTEGER NOT NULL CHECK (item_count BETWEEN 1 AND 10),
        FOREIGN KEY (log_id) REFERENCES instagram_publish_log(id) ON DELETE CASCADE
      )
    `)
    .run();

  await db
    .prepare(`
      CREATE INDEX IF NOT EXISTS instagram_publish_log_created_idx
      ON instagram_publish_log (created_at DESC)
    `)
    .run();
}

async function writeLog(
  db: D1Database,
  input: {
    villa: Villa;
    username: string | null;
    mediaUrls: string[];
    publishType: PublishType;
    caption: string;
    mediaId?: string | null;
    status: "Yayınlandı" | "Hata";
    error?: string | null;
  },
) {
  const now = new Date().toISOString();
  const logId = crypto.randomUUID();
  await ensureLogTable(db);

  await db.batch([
    db.prepare(`
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
    db.prepare(`
      INSERT INTO instagram_publish_log_details
        (log_id, publish_type, item_count)
      VALUES (?, ?, ?)
    `).bind(logId, input.publishType, input.mediaUrls.length),
  ]);
}

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  await ensureLogTable(db);

  const result = await db
    .prepare(`
      SELECT log.id, log.villa, log.username, log.image_url AS imageUrl,
             log.caption, log.instagram_media_id AS instagramMediaId,
             log.status, log.error_message AS errorMessage,
             log.created_at AS createdAt, log.published_at AS publishedAt,
             COALESCE(details.publish_type, 'IMAGE') AS publishType,
             COALESCE(details.item_count, 1) AS itemCount
      FROM instagram_publish_log AS log
      LEFT JOIN instagram_publish_log_details AS details
        ON details.log_id = log.id
      ORDER BY log.created_at DESC
      LIMIT 30
    `)
    .all();

  return Response.json({ items: result.results });
}

export async function POST(request: Request) {
  let db: D1Database | undefined;
  let publishRequest: PublishRequest | undefined;
  let username: string | null = null;

  try {
    const body: unknown = await request.json();
    publishRequest = parsePublishRequest(body);

    const { env } = await getCloudflareContext({ async: true });
    db = env.DB;

    // Eski imageUrl istemcileri geçici olarak çalışmaya devam eder.
    // Yeni yayın merkezi yalnızca metadata ile doğrulanan KV medya URL'lerini kullanır.
    if (!publishRequest.legacyImageRequest) {
      await validateManagedMedia(env, publishRequest);
    }

    const connection = await resolveInstagramConnection(publishRequest.villa);
    username = connection.username;

    const mediaId = await publishByType(connection, publishRequest);
    await writeLog(db, {
      villa: publishRequest.villa,
      username,
      mediaUrls: publishRequest.mediaUrls,
      publishType: publishRequest.type,
      caption: publishRequest.caption,
      mediaId,
      status: "Yayınlandı",
    });

    const typeLabel =
      publishRequest.type === "CAROUSEL"
        ? "Carousel"
        : publishRequest.type === "REELS"
          ? "Reels"
          : "Fotoğraf";

    return Response.json({
      ok: true,
      type: publishRequest.type,
      itemCount: publishRequest.mediaUrls.length,
      instagramMediaId: mediaId,
      username,
      message: "Instagram " + typeLabel + " gönderisi başarıyla yayınlandı.",
    });
  } catch (error) {
    const message = safeInstagramError(error);

    if (db && publishRequest) {
      try {
        await writeLog(db, {
          villa: publishRequest.villa,
          username,
          mediaUrls: publishRequest.mediaUrls,
          publishType: publishRequest.type,
          caption: publishRequest.caption,
          status: "Hata",
          error: message,
        });
      } catch {
        // Ana hatayı gölgelememek için log hatası sessiz bırakılır.
      }
    }

    console.error(
      JSON.stringify({
        message: "instagram publish failed",
        villa: publishRequest?.villa ?? null,
        publishType: publishRequest?.type ?? null,
        error: message,
      }),
    );

    return Response.json({ error: message }, { status: 400 });
  }
}
