import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Villa } from "./types";

const INSTAGRAM_AUTH = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH = "https://graph.instagram.com";

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

  if (missing.length > 0) {
    throw new Error(`Eksik ortam değişkenleri: ${missing.join(", ")}`);
  }

  return {
    appId,
    appSecret,
    baseUrl: baseUrl.replace(/\/$/, ""),
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
  const { appId, baseUrl } = await metaConfig();

  const state = await makeInstagramState(
    villa,
    nonce
  );

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: `${baseUrl}/api/meta/instagram/callback`,
    response_type: "code",
    scope:
      "instagram_business_basic,instagram_business_content_publish",
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
    baseUrl,
  } = await metaConfig();

  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: `${baseUrl}/api/meta/instagram/callback`,
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
    error_message?: string;
  };

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      data.error_message ??
        "Instagram erişim anahtarı alınamadı."
    );
  }

  return {
    accessToken: data.access_token,
    userId: String(data.user_id ?? ""),
  };
}

export async function getInstagramProfile(
  accessToken: string
) {
  const params = new URLSearchParams({
    fields: "id,username",
    access_token: accessToken,
  });

  const response = await fetch(
    `${INSTAGRAM_GRAPH}/me?${params.toString()}`
  );

  const data = (await response.json()) as {
    id?: string;
    username?: string;
    error?: {
      message?: string;
    };
  };

  if (
    !response.ok ||
    !data.id
  ) {
    throw new Error(
      data.error?.message ??
        "Instagram profili alınamadı."
    );
  }

  return {
    id: data.id,
    username:
      data.username ?? "instagram",
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
