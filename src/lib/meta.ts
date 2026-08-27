import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Villa } from "./types";

const INSTAGRAM_AUTH = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH = "https://graph.instagram.com";
const INSTAGRAM_CALLBACK_URI =
  "https://villa-yonetim.caglarmurat10.workers.dev/api/meta/instagram/callback";

type MetaApiError = {
  message?: unknown;
  type?: unknown;
  code?: unknown;
  error_subcode?: unknown;
};

type LongTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: MetaApiError;
};

export async function metaConfig() {
  const { env } = await getCloudflareContext({ async: true });

  const appId =
    env.META_APP_ID ||
    process.env.META_APP_ID;

  const appSecret =
    env.META_APP_SECRET ||
    process.env.META_APP_SECRET;

  const baseUrl =
    env.APP_BASE_URL ||
    process.env.APP_BASE_URL;

  const missing = [
    !appId ? "META_APP_ID" : null,
    !appSecret ? "META_APP_SECRET" : null,
    !baseUrl ? "APP_BASE_URL" : null,
  ].filter(Boolean);

  if (!appId || !appSecret || !baseUrl) {
    throw new Error(`Eksik ortam değişkenleri: ${missing.join(", ")}`);
  }

  return {
    appId,
    appSecret,
    baseUrl: baseUrl.trim().replace(/\/+$/, ""),
    instagramRedirectUri: INSTAGRAM_CALLBACK_URI,
  };
}

export async function makeInstagramState(villa: Villa, nonce: string) {
  const { appSecret } = await metaConfig();

  const payload = `${villa}.${nonce}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payload)
    )
  );

  return `${payload}.${Array.from(signature)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function verifyInstagramState(state: string) {
  const parts = state.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [villa, nonce, signature] = parts;

  if (villa !== "Safira" && villa !== "Destan") {
    return null;
  }

  const expected = await makeInstagramState(
    villa,
    nonce
  );

  if (
    expected !== state ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return null;
  }

  return {
    villa: villa as Villa,
    nonce,
  };
}

export async function instagramAuthorizeUrl(
  villa: Villa,
  nonce: string
) {
  const { appId, instagramRedirectUri } = await metaConfig();

  const state = await makeInstagramState(
    villa,
    nonce
  );

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: instagramRedirectUri,
    response_type: "code",
    scope:
      "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights",
    state,
    force_reauth: "true",
  });

  return `${INSTAGRAM_AUTH}?${params.toString()}`;
}

export async function exchangeInstagramCode(
  code: string
) {
  const {
    appId,
    appSecret,
    instagramRedirectUri,
  } = await metaConfig();

  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: instagramRedirectUri,
    code,
  });

  const response = await fetch(
    INSTAGRAM_TOKEN,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const data = (await response.json()) as {
    access_token?: string;
    user_id?: number | string;
  };

  if (
    !response.ok ||
    !data.access_token ||
    data.user_id === undefined ||
    data.user_id === null ||
    String(data.user_id).length === 0
  ) {
    throw new Error(
      `Instagram kısa ömürlü erişim anahtarı veya user_id alınamadı (HTTP ${response.status}).`
    );
  }

  return {
    accessToken: data.access_token,
    userId: String(data.user_id),
  };
}

function safeMetaErrorValue(value: unknown) {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";

  return value
    .replace(
      /(access_token|client_secret|authorization_code|short_lived_token|long_lived_token)=([^&\s]+)/gi,
      "$1=[REDACTED]"
    )
    .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
    .slice(0, 220);
}

function longTokenErrorMessage(
  status: number,
  error: MetaApiError | undefined
) {
  const parts: string[] = [];
  const message = safeMetaErrorValue(error?.message);
  const type = safeMetaErrorValue(error?.type);
  const code = safeMetaErrorValue(error?.code);
  const subcode = safeMetaErrorValue(error?.error_subcode);

  if (message) parts.push(`message=${message}`);
  if (type) parts.push(`type=${type}`);
  if (code) parts.push(`code=${code}`);
  if (subcode) parts.push(`error_subcode=${subcode}`);

  return parts.length
    ? `Meta uzun token hatası (HTTP ${status}): ${parts.join(" | ")}`
    : `Meta uzun token hatası (HTTP ${status}).`;
}

export async function exchangeInstagramLongLivedToken(
  accessToken: string
) {
  const { appSecret } = await metaConfig();
  const tokenUrl = new URL(`${INSTAGRAM_GRAPH}/access_token`);
  tokenUrl.searchParams.set("grant_type", "ig_exchange_token");
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("access_token", accessToken);

  const response = await fetch(tokenUrl, {
    method: "GET",
  });

  const data = (await response.json().catch(() => ({}))) as LongTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new Error(
      longTokenErrorMessage(response.status, data.error)
    );
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type ?? "bearer",
    expiresIn: data.expires_in ?? null,
  };
}

function safeProfileErrorValue(value: unknown, accessToken: string) {
  const safe = safeMetaErrorValue(value);
  if (!safe) return "";

  const encodedToken = encodeURIComponent(accessToken);
  return safe
    .split(accessToken)
    .join("[REDACTED]")
    .split(encodedToken)
    .join("[REDACTED]");
}

function profileErrorMessage(
  status: number,
  error: MetaApiError | undefined,
  accessToken: string
) {
  const parts: string[] = [];
  const message = safeProfileErrorValue(error?.message, accessToken);
  const type = safeProfileErrorValue(error?.type, accessToken);
  const code = safeProfileErrorValue(error?.code, accessToken);
  const subcode = safeProfileErrorValue(error?.error_subcode, accessToken);

  if (message) parts.push(`message=${message}`);
  if (type) parts.push(`type=${type}`);
  if (code) parts.push(`code=${code}`);
  if (subcode) parts.push(`error_subcode=${subcode}`);

  return parts.length
    ? `Meta profil hatası (HTTP ${status}): ${parts.join(" | ")}`
    : `Meta profil hatası (HTTP ${status}).`;
}

export async function getInstagramProfile(
  _userId: string,
  accessToken: string
) {
  const profileUrl =
    `${INSTAGRAM_GRAPH}/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(profileUrl, {
    method: "GET",
  });

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    username?: string;
    error?: MetaApiError;
  };

  if (!response.ok) {
    throw new Error(
      profileErrorMessage(response.status, data.error, accessToken)
    );
  }

  if (!data.id || !data.username) {
    throw new Error(
      `Instagram profil yanıtı id ve username içermiyor (HTTP ${response.status}).`
    );
  }

  return {
    id: data.id,
    username: data.username,
    accountType: "unknown",
  };
}

export async function publishInstagramImage(
  accountId: string,
  accessToken: string,
  imageUrl: string,
  caption: string
) {
  const create = await fetch(
    `${INSTAGRAM_GRAPH}/${accountId}/media`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    }
  );

  const created = (await create.json()) as {
    id?: string;
    error?: {
      message?: string;
    };
  };

  if (
    !create.ok ||
    !created.id
  ) {
    throw new Error(
      created.error?.message ??
        "Instagram medya hazırlığı başarısız."
    );
  }

  const publish = await fetch(
    `${INSTAGRAM_GRAPH}/${accountId}/media_publish`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        creation_id: created.id,
        access_token: accessToken,
      }),
    }
  );

  const published = (await publish.json()) as {
    id?: string;
    error?: {
      message?: string;
    };
  };

  if (
    !publish.ok ||
    !published.id
  ) {
    throw new Error(
      published.error?.message ??
        "Instagram yayını başarısız."
    );
  }

  return published.id;
}
