import { getInstagramTokenCandidates } from "@/lib/instagramTokenStore";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

type D1DatabaseLike = {
  prepare: (query: string) => D1Statement;
};

type DbEnv = {
  DB?: D1DatabaseLike;
};

type Connection = {
  accessToken: string;
  igUserId: string;
  username: string | null;
};

type MetaError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
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

const TOKEN_COLUMNS = [
  "access_token",
  "instagram_access_token",
  "long_lived_access_token",
  "long_lived_token",
  "long_token",
  "accessToken",
  "token",
];

const ID_COLUMNS = [
  "instagram_user_id",
  "instagram_account_id",
  "ig_user_id",
  "instagram_id",
  "account_id",
  "user_id",
  "instagramUserId",
];

const VILLA_COLUMNS = ["villa", "villa_name", "property", "property_name"];
const USERNAME_COLUMNS = ["username", "instagram_username", "ig_username"];
const ORDER_COLUMNS = ["updated_at", "connected_at", "created_at", "id"];

const CONNECTION_TABLES = [
  "instagram_connections",
  "instagram_connection",
  "meta_connections",
  "meta_connection",
  "instagram_accounts",
  "instagram_account",
  "meta_instagram_connections",
  "meta_instagram_accounts",
  "social_connections",
  "social_accounts",
  "social_media_connections",
  "social_media_accounts",
  "connected_instagram_accounts",
  "connected_accounts",
  "oauth_connections",
  "oauth_accounts",
  "meta_accounts",
  "social_integrations",
  "integrations",
  "integration_accounts",
  "instagram_tokens",
  "meta_tokens",
  "settings",
  "app_settings",
  "social_settings",
  "accounts",
  "connections",
] as const;


function safeIdentifier(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function q(value: string) {
  if (!safeIdentifier(value)) throw new Error("Geçersiz veritabanı alanı.");
  return `"${value}"`;
}

function firstColumn(columns: string[], candidates: string[]) {
  const lower = new Map(columns.map((column) => [column.toLowerCase(), column]));
  for (const candidate of candidates) {
    const found = lower.get(candidate.toLowerCase());
    if (found) return found;
  }
  return null;
}

function tableScore(name: string) {
  const value = name.toLowerCase();
  let score = 0;
  if (value.includes("instagram")) score += 30;
  if (value.includes("meta")) score += 20;
  if (value.includes("connection")) score += 15;
  if (value.includes("account")) score += 10;
  if (value.includes("social")) score += 5;
  return score;
}

function normalizeStoredToken(value: unknown) {
  if (value == null) return "";
  let token = String(value).trim();
  if (!token) return "";

  if (token.startsWith("{")) {
    try {
      const parsed = JSON.parse(token) as Record<string, unknown>;
      const nested =
        parsed.access_token ??
        parsed.accessToken ??
        parsed.long_lived_access_token ??
        parsed.long_lived_token ??
        parsed.token;
      if (nested != null) token = String(nested).trim();
    } catch {
      // JSON değilse ham değer sonraki normalizasyonlardan geçer.
    }
  }

  token = token.replace(/^Bearer\s+/i, "").trim();

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  if (/^access_token=/i.test(token)) {
    try {
      token = new URLSearchParams(token).get("access_token")?.trim() ?? token;
    } catch {}
  }

  if (/%[0-9A-Fa-f]{2}/.test(token)) {
    try {
      token = decodeURIComponent(token);
    } catch {}
  }

  return token.trim();
}

function requestedUsernameHint(villa: string) {
  if (villa === "Destan") return "villadestanpatara";
  if (villa === "Safira") return "villasafira";
  return "";
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function safeMetaMessage(data: MetaError, status: number, fallback: string) {
  const error = data?.error;
  const message =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : `${fallback} (HTTP ${status}).`;

  const code = typeof error?.code === "number" ? ` [kod ${error.code}]` : "";
  const subcode =
    typeof error?.error_subcode === "number"
      ? ` [alt kod ${error.error_subcode}]`
      : "";
  const type = typeof error?.type === "string" ? ` [${error.type}]` : "";
  return `${message}${type}${code}${subcode}`;
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

type Candidate = {
  token: string;
  storedUsername: string | null;
  storedVilla: string | null;
  tableScore: number;
};

function lowerKeyMap(row: Record<string, unknown>) {
  const map = new Map<string, string>();
  for (const key of Object.keys(row)) map.set(key.toLowerCase(), key);
  return map;
}

function valueByNames(row: Record<string, unknown>, names: string[]) {
  const map = lowerKeyMap(row);
  for (const name of names) {
    const actual = map.get(name.toLowerCase());
    if (actual) return row[actual];
  }
  return undefined;
}

function tokenCandidatesFromRow(row: Record<string, unknown>) {
  const tokens: string[] = [];
  const seen = new Set<string>();

  const push = (value: unknown) => {
    const token = normalizeStoredToken(value);
    if (!token || token.length < 20 || seen.has(token)) return;
    seen.add(token);
    tokens.push(token);
  };

  // Önce alan adı açıkça token/access belirten sütunlar.
  for (const [key, value] of Object.entries(row)) {
    const lower = key.toLowerCase();
    if (lower.includes("token") || lower.includes("access")) push(value);
  }

  // Bazı sürümlerde bağlantı verisi JSON olarak tek kolonda tutulabilir.
  for (const value of Object.values(row)) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed.startsWith("{")) continue;

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const [key, nested] of Object.entries(parsed)) {
        const lower = key.toLowerCase();
        if (lower.includes("token") || lower.includes("access")) push(nested);
      }
    } catch {}
  }

  return tokens;
}

async function resolveConnection(
  db: D1DatabaseLike,
  villa: string,
): Promise<Connection> {
  // KV_CANDIDATE_RESOLUTION_V2
  // OAuth long-lived exchange sırasında kaydedilen ham tokenları Meta ile doğrula.
  const kvTokenCandidates = await getInstagramTokenCandidates();
  if (kvTokenCandidates.length) {
    const hint = requestedUsernameHint(villa).toLowerCase();

    for (const kvToken of kvTokenCandidates) {
      const kvProfile = await validateInstagramToken(kvToken);
      if (!kvProfile) continue;

      const candidateUsername = kvProfile.username.toLowerCase();
      const exact = hint && candidateUsername === hint;
      const villaMatch =
        (villa === "Destan" && candidateUsername.includes("destan")) ||
        (villa === "Safira" && candidateUsername.includes("safira"));

      if (exact || villaMatch) {
        return {
          accessToken: kvToken,
          igUserId: kvProfile.id,
          username: kvProfile.username,
        };
      }
    }
  }

  const hint = requestedUsernameHint(villa).toLowerCase();

  type RuntimeCandidate = Candidate & {
    table: string;
  };

  const candidates: RuntimeCandidate[] = [];
  const readableTables: string[] = [];

  for (const table of CONNECTION_TABLES) {
    let rows: Record<string, unknown>[] = [];

    try {
      const result = await db
        .prepare(`SELECT * FROM "${table}" LIMIT 100`)
        .all<Record<string, unknown>>();

      rows = result.results;
      readableTables.push(table);
    } catch {
      // Tablo yoksa veya bu isim kullanılmıyorsa sıradaki olası tabloya geç.
      continue;
    }

    for (const row of rows) {
      const storedUsernameValue = valueByNames(row, USERNAME_COLUMNS);
      const storedVillaValue = valueByNames(row, VILLA_COLUMNS);

      const storedUsername =
        storedUsernameValue == null ? null : String(storedUsernameValue).trim();
      const storedVilla =
        storedVillaValue == null ? null : String(storedVillaValue).trim();

      for (const token of tokenCandidatesFromRow(row)) {
        candidates.push({
          token,
          storedUsername,
          storedVilla,
          tableScore: tableScore(table),
          table,
        });
      }
    }
  }

  candidates.sort((a, b) => {
    function score(candidate: RuntimeCandidate) {
      let value = candidate.tableScore;

      if (
        candidate.storedVilla &&
        candidate.storedVilla.toLowerCase() === villa.toLowerCase()
      ) {
        value += 100;
      }

      if (
        hint &&
        candidate.storedUsername &&
        candidate.storedUsername.toLowerCase() === hint
      ) {
        value += 200;
      }

      if (candidate.table.includes("instagram")) value += 30;
      if (candidate.table.includes("meta")) value += 10;

      return value;
    }

    return score(b) - score(a);
  });

  const seen = new Set<string>();
  let tested = 0;

  for (const candidate of candidates) {
    if (seen.has(candidate.token)) continue;
    seen.add(candidate.token);

    // Bir istekte sınırsız dış doğrulama yapılmasını engelle.
    if (tested >= 25) break;
    tested += 1;

    const profile = await validateInstagramToken(candidate.token);
    if (!profile) continue;

    const username = profile.username.toLowerCase();

    if (hint && username !== hint) {
      if (villa === "Destan" && !username.includes("destan")) continue;
      if (villa === "Safira" && !username.includes("safira")) continue;
    }

    return {
      accessToken: candidate.token,
      igUserId: profile.id,
      username: profile.username,
    };
  }

  if (readableTables.length === 0) {
    throw new Error(
      "Instagram bağlantı tablosu bulunamadı. OAuth bağlantı kaydının tablo adı mevcut yayın sürümüyle eşleşmiyor.",
    );
  }

  if (candidates.length === 0) {
    throw new Error(
      `Instagram bağlantı kaydı bulundu ancak erişim anahtarı alanı bulunamadı. Okunan bağlantı tablosu sayısı: ${readableTables.length}.`,
    );
  }

  throw new Error(
    `${villa} için ${Math.min(seen.size, 25)} erişim anahtarı adayı kontrol edildi ancak Meta geçerli bir Instagram tokenı kabul etmedi. Bağlantı kaydının token formatı düzeltilmeli.`,
  );
}

async function ensureLogTable(db: D1DatabaseLike) {
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
  db: D1DatabaseLike,
  input: {
    villa: string;
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
  const db = (env as unknown as DbEnv).DB;

  if (!db) {
    return Response.json(
      { error: "D1 veritabanı bağlantısı bulunamadı." },
      { status: 500 },
    );
  }

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
  let db: D1DatabaseLike | undefined;
  let villa = "";
  let imageUrl = "";
  let caption = "";
  let username: string | null = null;

  try {
    const body = (await request.json()) as {
      villa?: unknown;
      imageUrl?: unknown;
      caption?: unknown;
    };

    villa = String(body.villa ?? "");
    imageUrl = String(body.imageUrl ?? "").trim();
    caption = String(body.caption ?? "").trim();

    if (!["Destan", "Safira"].includes(villa)) {
      return Response.json({ error: "Geçerli villa seçin." }, { status: 400 });
    }

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
    db = (env as unknown as DbEnv).DB;

    if (!db) {
      return Response.json(
        { error: "D1 veritabanı bağlantısı bulunamadı." },
        { status: 500 },
      );
    }

    // Kritik düzeltme:
    // D1'den tokenı körlemesine seçmek yerine Meta /me ile doğrula.
    const connection = await resolveConnection(db, villa);
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

      if (!statusData.status_code || statusData.status_code === "FINISHED") {
        finished = true;
        break;
      }

      if (
        statusData.status_code === "ERROR" ||
        statusData.status_code === "EXPIRED"
      ) {
        throw new Error(
          statusData.status ||
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
    const message =
      error instanceof Error
        ? error.message
        : "Instagram yayını tamamlanamadı.";

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

    // Token, secret veya auth code loglanmaz.
    console.error("[instagram-publish]", message);

    return Response.json({ error: message }, { status: 400 });
  }
}
