import { getInstagramAccessToken } from "@/lib/instagramTokenStore";
import { getInstagramAccount } from "@/lib/meta-store";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";

type Connection = {
  accessToken: string;
  igUserId: string;
  username: string | null;
};

type MetaError = {
  error?: {
    message?: unknown;
    type?: unknown;
    code?: unknown;
    error_subcode?: unknown;
  };
};

type MetaIdResponse = MetaError & { id?: string };
type MetaStatusResponse = MetaError & {
  id?: string;
  status_code?: string;
  status?: string;
};
type MetaProfileResponse = MetaError & {
  id?: string;
  username?: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function safeMetaValue(value: unknown) {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";

  return value
    .replace(
      /(access_token|client_secret|authorization_code|short_lived_token|long_lived_token)=([^&\s]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
    .slice(0, 220);
}

function safeMetaMessage(data: MetaError, status: number, fallback: string) {
  const parts: string[] = [];
  const message = safeMetaValue(data.error?.message);
  const type = safeMetaValue(data.error?.type);
  const code = safeMetaValue(data.error?.code);
  const subcode = safeMetaValue(data.error?.error_subcode);

  if (message) parts.push(`message=${message}`);
  if (type) parts.push(`type=${type}`);
  if (code) parts.push(`code=${code}`);
  if (subcode) parts.push(`error_subcode=${subcode}`);

  return parts.length
    ? `${fallback}: ${parts.join(" | ")}`
    : `${fallback} (HTTP ${status}).`;
}

function safeUnexpectedMessage(error: unknown) {
  if (!(error instanceof Error) || !error.message) {
    return "Instagram yayını tamamlanamadı.";
  }
  return safeMetaValue(error.message) || "Instagram yayını tamamlanamadı.";
}

async function validateInstagramToken(accessToken: string) {
  if (accessToken.length < 20) return null;

  const profileUrl = new URL("https://graph.instagram.com/me");
  profileUrl.searchParams.set("fields", "id,username");
  profileUrl.searchParams.set("access_token", accessToken);

  const response = await fetch(profileUrl, { method: "GET" });
  const data = await readJson<MetaProfileResponse>(response);

  if (!response.ok || !data.id || !data.username) return null;

  return {
    id: String(data.id),
    username: String(data.username),
  };
}

const INVALID_TOKEN_MESSAGE =
  "Instagram bağlantısının erişim anahtarı geçersiz. Hesabı kaldırıp yeniden bağlayın.";

function isVilla(value: string): value is Villa {
  return value === "Destan" || value === "Safira";
}

async function resolveConnection(villa: Villa): Promise<Connection> {
  const account = await getInstagramAccount(villa);
  if (!account) {
    throw new Error(
      "Bu villa için bağlı Instagram hesabı bulunamadı. Önce hesabı bağlayın.",
    );
  }

  let accessToken: string | null = null;
  try {
    accessToken = await getInstagramAccessToken(villa, account.accountId);
  } catch {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }

  if (!accessToken) {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }

  let profile: Awaited<ReturnType<typeof validateInstagramToken>> = null;
  try {
    profile = await validateInstagramToken(accessToken);
  } catch {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }

  if (!profile || profile.id !== account.accountId) {
    throw new Error(INVALID_TOKEN_MESSAGE);
  }

  return {
    accessToken,
    igUserId: profile.id,
    username: profile.username,
  };
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
    imageUrl: string;
    caption: string;
    mediaId?: string | null;
    status: "Yayınlandı" | "Hata";
    error?: string | null;
  },
) {
  const now = new Date().toISOString();
  await ensureLogTable(db);

  await db
    .prepare(`
      INSERT INTO instagram_publish_log
        (id, villa, username, image_url, caption, instagram_media_id,
         status, error_message, created_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      input.villa,
      input.username,
      input.imageUrl,
      input.caption,
      input.mediaId ?? null,
      input.status,
      input.error ?? null,
      now,
      input.status === "Yayınlandı" ? now : null,
    )
    .run();
}

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  await ensureLogTable(db);

  const result = await db
    .prepare(`
      SELECT id, villa, username, image_url AS imageUrl, caption,
             instagram_media_id AS instagramMediaId, status,
             error_message AS errorMessage, created_at AS createdAt,
             published_at AS publishedAt
      FROM instagram_publish_log
      ORDER BY created_at DESC
      LIMIT 30
    `)
    .all();

  return Response.json({ items: result.results });
}

export async function POST(request: Request) {
  let db: D1Database | undefined;
  let villa: Villa | undefined;
  let imageUrl = "";
  let caption = "";
  let username: string | null = null;

  try {
    const body = (await request.json()) as {
      villa?: unknown;
      imageUrl?: unknown;
      caption?: unknown;
    };

    const requestedVilla = String(body.villa ?? "");
    imageUrl = String(body.imageUrl ?? "").trim();
    caption = String(body.caption ?? "").trim();

    if (!isVilla(requestedVilla)) {
      return Response.json({ error: "Geçerli villa seçin." }, { status: 400 });
    }
    villa = requestedVilla;

    if (!imageUrl.startsWith("https://")) {
      return Response.json(
        { error: "Instagram için HTTPS medya adresi gerekli." },
        { status: 400 },
      );
    }

    if (!caption || caption.length > 2200) {
      return Response.json(
        { error: "Paylaşım metni 1-2200 karakter arasında olmalı." },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    db = env.DB;

    const connection = await resolveConnection(villa);
    username = connection.username;

    const createBody = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: connection.accessToken,
    });

    const createResponse = await fetch(
      `https://graph.instagram.com/${encodeURIComponent(connection.igUserId)}/media`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: createBody,
      },
    );

    const createData = await readJson<MetaIdResponse>(createResponse);

    if (!createResponse.ok || !createData.id) {
      throw new Error(
        safeMetaMessage(
          createData,
          createResponse.status,
          "Instagram medya kapsayıcısı oluşturulamadı",
        ),
      );
    }

    const containerId = createData.id;
    let finished = false;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const statusUrl = new URL(
        `https://graph.instagram.com/${encodeURIComponent(containerId)}`,
      );
      statusUrl.searchParams.set("fields", "status_code,status");
      statusUrl.searchParams.set("access_token", connection.accessToken);

      const statusResponse = await fetch(statusUrl);
      const statusData = await readJson<MetaStatusResponse>(statusResponse);

      if (!statusResponse.ok) {
        throw new Error(
          safeMetaMessage(
            statusData,
            statusResponse.status,
            "Instagram medya durumu alınamadı",
          ),
        );
      }

      if (statusData.status_code === "FINISHED") {
        finished = true;
        break;
      }

      if (
        statusData.status_code === "ERROR" ||
        statusData.status_code === "EXPIRED"
      ) {
        throw new Error(
          safeMetaValue(statusData.status) ||
            `Instagram medya hazırlama durumu: ${statusData.status_code}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!finished) {
      throw new Error(
        "Instagram medyayı zamanında hazırlayamadı. Birkaç saniye sonra yeniden deneyin.",
      );
    }

    const publishBody = new URLSearchParams({
      creation_id: containerId,
      access_token: connection.accessToken,
    });

    const publishResponse = await fetch(
      `https://graph.instagram.com/${encodeURIComponent(connection.igUserId)}/media_publish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: publishBody,
      },
    );

    const publishData = await readJson<MetaIdResponse>(publishResponse);

    if (!publishResponse.ok || !publishData.id) {
      throw new Error(
        safeMetaMessage(
          publishData,
          publishResponse.status,
          "Instagram gönderisi yayınlanamadı",
        ),
      );
    }

    await writeLog(db, {
      villa,
      username,
      imageUrl,
      caption,
      mediaId: publishData.id,
      status: "Yayınlandı",
    });

    return Response.json({
      ok: true,
      instagramMediaId: publishData.id,
      username,
      message: "Instagram gönderisi başarıyla yayınlandı.",
    });
  } catch (error) {
    const message = safeUnexpectedMessage(error);

    if (db && villa && imageUrl && caption) {
      try {
        await writeLog(db, {
          villa,
          username,
          imageUrl,
          caption,
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
        villa: villa ?? null,
        error: message,
      }),
    );

    return Response.json({ error: message }, { status: 400 });
  }
}
