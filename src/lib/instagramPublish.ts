import { getInstagramAccessTokenFromEnv } from "@/lib/instagramTokenStore";
import { getInstagramAccountFromEnv } from "@/lib/meta-store";
import type {
  InstagramPublishInput,
  InstagramPublishType,
} from "@/lib/instagramTypes";
import type { Villa } from "@/lib/types";

const INSTAGRAM_GRAPH = "https://graph.instagram.com";
const META_TIMEOUT_MS = 20_000;
const MAX_META_JSON_LENGTH = 64 * 1024;
const INVALID_TOKEN_MESSAGE =
  "Instagram bağlantısının erişim anahtarı geçersiz. Hesabı yeniden bağlayın.";

export type InstagramConnection = {
  accessToken: string;
  igUserId: string;
  username: string;
};

export type InstagramPublishResult = {
  instagramMediaId: string;
  username: string;
};

export type InstagramPublishHooks = {
  beforeFinalPublish?: () => Promise<void>;
  afterExternalPublish?: (mediaId: string) => Promise<void>;
};

export class InstagramPublishError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code:
      | "INVALID_TOKEN"
      | "NETWORK"
      | "META_TEMPORARY"
      | "PROCESSING_TIMEOUT"
      | "META_PERMANENT",
  ) {
    super(message);
    this.name = "InstagramPublishError";
  }
}

type ContainerWaitKind = "IMAGE" | "REELS";

type PollingPolicy = {
  maxAttempts: number;
  delayMs: (attempt: number) => number;
  timeoutMessage: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_META_JSON_LENGTH) {
    await response.body?.cancel();
    return {};
  }

  const text = await response.text();
  if (text.length > MAX_META_JSON_LENGTH) return {};
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

export function safeMetaValue(value: unknown) {
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

function safeMetaMessage(
  data: Record<string, unknown>,
  status: number,
  fallback: string,
) {
  const error = isRecord(data.error) ? data.error : {};
  const parts: string[] = [];
  const message = safeMetaValue(error.message);
  const type = safeMetaValue(error.type);
  const code = safeMetaValue(error.code);
  const subcode = safeMetaValue(error.error_subcode);

  if (message) parts.push(`message=${message}`);
  if (type) parts.push(`type=${type}`);
  if (code) parts.push(`code=${code}`);
  if (subcode) parts.push(`error_subcode=${subcode}`);

  return parts.length
    ? `${fallback}: ${parts.join(" | ")}`
    : `${fallback} (HTTP ${status}).`;
}

function responseError(
  data: Record<string, unknown>,
  status: number,
  fallback: string,
) {
  const retryable = status === 429 || status >= 500;
  return new InstagramPublishError(
    safeMetaMessage(data, status, fallback),
    retryable,
    retryable ? "META_TEMPORARY" : "META_PERMANENT",
  );
}

async function metaFetch(
  input: string | URL,
  init: RequestInit,
  networkMessage: string,
) {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(META_TIMEOUT_MS),
    });
  } catch {
    throw new InstagramPublishError(networkMessage, true, "NETWORK");
  }
}

export function safeInstagramError(
  error: unknown,
  fallback = "Instagram yayını tamamlanamadı.",
) {
  if (!(error instanceof Error) || !error.message) return fallback;
  return safeMetaValue(error.message) || fallback;
}

export function isRetryableInstagramError(error: unknown) {
  return error instanceof InstagramPublishError && error.retryable;
}

async function validateInstagramToken(accessToken: string) {
  if (accessToken.length < 20) return null;

  const profileUrl = new URL(`${INSTAGRAM_GRAPH}/me`);
  profileUrl.searchParams.set("fields", "id,username");
  profileUrl.searchParams.set("access_token", accessToken);

  const response = await metaFetch(
    profileUrl,
    { method: "GET" },
    "Instagram hesabı doğrulanırken geçici bağlantı hatası oluştu.",
  );
  const data = await readJson(response);

  if (!response.ok) {
    if (response.status === 429 || response.status >= 500) {
      throw responseError(
        data,
        response.status,
        "Instagram hesabı doğrulanamadı",
      );
    }
    return null;
  }
  const id = stringValue(data.id);
  const username = stringValue(data.username);

  return id && username ? { id, username } : null;
}

export async function resolveInstagramConnection(
  env: CloudflareEnv,
  villa: Villa,
): Promise<InstagramConnection> {
  const account = await getInstagramAccountFromEnv(env, villa);
  if (!account) {
    throw new InstagramPublishError(
      "Bu villa için bağlı Instagram hesabı bulunamadı. Önce hesabı bağlayın.",
      false,
      "META_PERMANENT",
    );
  }

  let accessToken: string | null = null;
  try {
    accessToken = await getInstagramAccessTokenFromEnv(
      env,
      villa,
      account.accountId,
    );
  } catch {
    throw new InstagramPublishError(
      INVALID_TOKEN_MESSAGE,
      false,
      "INVALID_TOKEN",
    );
  }

  if (!accessToken) {
    throw new InstagramPublishError(
      INVALID_TOKEN_MESSAGE,
      false,
      "INVALID_TOKEN",
    );
  }

  let profile: Awaited<ReturnType<typeof validateInstagramToken>> = null;
  try {
    profile = await validateInstagramToken(accessToken);
  } catch (error) {
    if (error instanceof InstagramPublishError) throw error;
    throw new InstagramPublishError(
      INVALID_TOKEN_MESSAGE,
      false,
      "INVALID_TOKEN",
    );
  }

  if (!profile || profile.id !== account.accountId) {
    throw new InstagramPublishError(
      INVALID_TOKEN_MESSAGE,
      false,
      "INVALID_TOKEN",
    );
  }

  return {
    accessToken,
    igUserId: profile.id,
    username: profile.username,
  };
}

export async function createInstagramContainer(
  connection: InstagramConnection,
  parameters: Readonly<Record<string, string>>,
  fallback: string,
) {
  const response = await metaFetch(
    `${INSTAGRAM_GRAPH}/${encodeURIComponent(connection.igUserId)}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...parameters,
        access_token: connection.accessToken,
      }),
    },
    `${fallback}: geçici bağlantı hatası.`,
  );
  const data = await readJson(response);
  const id = stringValue(data.id);

  if (!response.ok || !id) {
    throw responseError(data, response.status, fallback);
  }

  return id;
}

function pollingPolicy(kind: ContainerWaitKind): PollingPolicy {
  if (kind === "REELS") {
    return {
      maxAttempts: 14,
      delayMs: (attempt) => Math.min(1500 + attempt * 500, 5000),
      timeoutMessage:
        "Instagram Reels videosunu henüz hazırlayamadı. Biraz sonra yeniden deneyin.",
    };
  }

  return {
    maxAttempts: 10,
    delayMs: () => 1000,
    timeoutMessage:
      "Instagram medyayı zamanında hazırlayamadı. Birkaç saniye sonra yeniden deneyin.",
  };
}

export async function waitForInstagramContainer(
  connection: InstagramConnection,
  containerId: string,
  kind: ContainerWaitKind,
  context: string,
) {
  const policy = pollingPolicy(kind);

  for (let attempt = 0; attempt < policy.maxAttempts; attempt += 1) {
    const statusUrl = new URL(
      `${INSTAGRAM_GRAPH}/${encodeURIComponent(containerId)}`,
    );
    statusUrl.searchParams.set("fields", "status_code,status");
    statusUrl.searchParams.set("access_token", connection.accessToken);

    const response = await metaFetch(
      statusUrl,
      { method: "GET" },
      `${context} durumu alınırken geçici bağlantı hatası oluştu.`,
    );
    const data = await readJson(response);

    if (!response.ok) {
      throw responseError(
        data,
        response.status,
        `${context} durumu alınamadı`,
      );
    }

    const statusCode = stringValue(data.status_code);
    if (statusCode === "FINISHED") return;

    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      const status = safeMetaValue(data.status);
      throw new InstagramPublishError(
        status || `${context} hazırlama durumu: ${statusCode}`,
        false,
        "META_PERMANENT",
      );
    }

    if (attempt < policy.maxAttempts - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, policy.delayMs(attempt)),
      );
    }
  }

  throw new InstagramPublishError(
    policy.timeoutMessage,
    true,
    "PROCESSING_TIMEOUT",
  );
}

export async function publishInstagramContainer(
  connection: InstagramConnection,
  containerId: string,
) {
  const response = await metaFetch(
    `${INSTAGRAM_GRAPH}/${encodeURIComponent(connection.igUserId)}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: connection.accessToken,
      }),
    },
    "Instagram gönderisi yayınlanırken geçici bağlantı hatası oluştu.",
  );
  const data = await readJson(response);
  const id = stringValue(data.id);

  if (!response.ok || !id) {
    throw responseError(
      data,
      response.status,
      "Instagram gönderisi yayınlanamadı",
    );
  }

  return id;
}

async function publishImage(
  connection: InstagramConnection,
  mediaUrl: string,
  caption: string,
  hooks: InstagramPublishHooks,
) {
  const containerId = await createInstagramContainer(
    connection,
    { image_url: mediaUrl, ...(caption ? { caption } : {}) },
    "Instagram medya kapsayıcısı oluşturulamadı",
  );
  await waitForInstagramContainer(
    connection,
    containerId,
    "IMAGE",
    "Instagram fotoğrafı",
  );
  if (hooks.beforeFinalPublish) await hooks.beforeFinalPublish();
  return publishInstagramContainer(connection, containerId);
}

async function publishCarousel(
  connection: InstagramConnection,
  mediaUrls: string[],
  caption: string,
  hooks: InstagramPublishHooks,
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
      if (error instanceof InstagramPublishError) throw error;
      throw new InstagramPublishError(
        `Carousel ${index + 1}. öğesi hazırlanamadı: ${safeInstagramError(
          error,
          "Instagram medya hazırlığı başarısız.",
        )}`,
        false,
        "META_PERMANENT",
      );
    }
  }

  const parentId = await createInstagramContainer(
    connection,
    {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      ...(caption ? { caption } : {}),
    },
    "Instagram Carousel kapsayıcısı oluşturulamadı",
  );
  await waitForInstagramContainer(
    connection,
    parentId,
    "IMAGE",
    "Instagram Carousel",
  );
  if (hooks.beforeFinalPublish) await hooks.beforeFinalPublish();
  return publishInstagramContainer(connection, parentId);
}

async function publishReels(
  connection: InstagramConnection,
  mediaUrl: string,
  caption: string,
  shareToFeed: boolean,
  hooks: InstagramPublishHooks,
) {
  const containerId = await createInstagramContainer(
    connection,
    {
      media_type: "REELS",
      video_url: mediaUrl,
      share_to_feed: String(shareToFeed),
      ...(caption ? { caption } : {}),
    },
    "Instagram Reels kapsayıcısı oluşturulamadı",
  );
  await waitForInstagramContainer(
    connection,
    containerId,
    "REELS",
    "Instagram Reels videosu",
  );
  if (hooks.beforeFinalPublish) await hooks.beforeFinalPublish();
  return publishInstagramContainer(connection, containerId);
}

async function publishByType(
  connection: InstagramConnection,
  input: InstagramPublishInput,
  hooks: InstagramPublishHooks,
) {
  if (input.type === "CAROUSEL") {
    return publishCarousel(connection, input.mediaUrls, input.caption, hooks);
  }
  if (input.type === "REELS") {
    return publishReels(
      connection,
      input.mediaUrls[0],
      input.caption,
      input.shareToFeed,
      hooks,
    );
  }
  return publishImage(connection, input.mediaUrls[0], input.caption, hooks);
}

export async function publishInstagramPost(
  env: CloudflareEnv,
  input: InstagramPublishInput,
  hooks: InstagramPublishHooks = {},
): Promise<InstagramPublishResult> {
  const connection = await resolveInstagramConnection(env, input.villa);
  const instagramMediaId = await publishByType(connection, input, hooks);
  if (hooks.afterExternalPublish) {
    await hooks.afterExternalPublish(instagramMediaId);
  }
  return { instagramMediaId, username: connection.username };
}

export function instagramTypeLabel(type: InstagramPublishType) {
  return type === "CAROUSEL"
    ? "Carousel"
    : type === "REELS"
      ? "Reels"
      : "Fotoğraf";
}
