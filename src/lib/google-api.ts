import { getCloudflareContext } from "@opennextjs/cloudflare";

export type GoogleConnectionKey = "search_console" | "ga4" | "gbp";

type StoredConnection = {
  refreshToken?: string;
  connectedAt?: string;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};

export async function hasGoogleConnection(scopeKey: GoogleConnectionKey): Promise<boolean> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_PRIVATE) return false;
    return Boolean(await env.GOOGLE_PRIVATE.get(`connection:${scopeKey}`));
  } catch (error) {
    console.error(`[Google OAuth] connection check ${scopeKey} failed: ${error instanceof Error ? error.message : "unknown"}`);
    return false;
  }
}

export async function getGoogleAccessToken(scopeKey: GoogleConnectionKey): Promise<string> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_OAUTH_CLIENT_NOT_CONFIGURED");
  }
  if (!env.GOOGLE_PRIVATE) {
    throw new Error("GOOGLE_PRIVATE_NOT_CONFIGURED");
  }

  const raw = await env.GOOGLE_PRIVATE.get(`connection:${scopeKey}`);
  if (!raw) throw new Error(`GOOGLE_CONNECTION_MISSING:${scopeKey}`);

  let connection: StoredConnection;
  try {
    connection = JSON.parse(raw) as StoredConnection;
  } catch {
    throw new Error(`GOOGLE_CONNECTION_INVALID:${scopeKey}`);
  }
  if (!connection.refreshToken) throw new Error(`GOOGLE_REFRESH_TOKEN_MISSING:${scopeKey}`);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    console.error(`[Google OAuth] refresh ${scopeKey} HTTP ${response.status}`);
    throw new Error(`GOOGLE_TOKEN_REFRESH_FAILED:${scopeKey}:${response.status}`);
  }

  const token = await response.json() as TokenResponse;
  if (!token.access_token) throw new Error(`GOOGLE_ACCESS_TOKEN_MISSING:${scopeKey}`);
  return token.access_token;
}
