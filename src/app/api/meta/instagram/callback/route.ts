import {
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  getInstagramProfile,
  verifyInstagramState,
} from "@/lib/meta";
import { saveInstagramAccount } from "@/lib/meta-store";

type OAuthStage =
  | "state"
  | "nonce-cookie"
  | "code-exchange"
  | "long-token-exchange"
  | "profile-fetch"
  | "database-save";

function cookieValue(header: string | null, name: string) {
  if (!header) return "";
  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;

  return error.message
    .replace(
      /(access_token|client_secret|authorization_code|short_lived_token|long_lived_token)=([^&\s]+)/gi,
      "$1=[REDACTED]"
    )
    .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
    .slice(0, 480);
}

function errorRedirect(url: URL, stage: OAuthStage, message: string) {
  const target = new URL("/sosyal", url.origin);
  target.searchParams.set("meta_error", message);
  target.searchParams.set("meta_stage", stage);

  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Set-Cookie":
        "ig_oauth_nonce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}

function stageFailure(
  url: URL,
  stage: OAuthStage,
  error: unknown,
  fallback: string
) {
  const message = safeErrorMessage(error, fallback);
  console.error(`[Instagram OAuth][${stage}] ${message}`);
  return errorRedirect(url, stage, message);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerError =
    url.searchParams.get("error") ||
    url.searchParams.get("error_reason");

  if (providerError) {
    return stageFailure(
      url,
      "state",
      new Error("Meta OAuth isteği reddedildi."),
      "Meta OAuth isteği reddedildi."
    );
  }

  const state = url.searchParams.get("state");
  if (!state) {
    return stageFailure(
      url,
      "state",
      new Error("OAuth state parametresi eksik."),
      "OAuth state doğrulaması başarısız."
    );
  }

  let parsed: Awaited<ReturnType<typeof verifyInstagramState>>;
  try {
    parsed = await verifyInstagramState(state);
  } catch (error) {
    return stageFailure(
      url,
      "state",
      error,
      "OAuth state doğrulaması başarısız."
    );
  }

  if (!parsed) {
    return stageFailure(
      url,
      "state",
      new Error("OAuth state imzası geçersiz."),
      "OAuth state doğrulaması başarısız."
    );
  }

  const nonce = cookieValue(
    request.headers.get("cookie"),
    "ig_oauth_nonce"
  );
  if (!nonce || parsed.nonce !== nonce) {
    return stageFailure(
      url,
      "nonce-cookie",
      new Error("OAuth nonce cookie doğrulaması başarısız."),
      "OAuth nonce cookie doğrulaması başarısız."
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return stageFailure(
      url,
      "code-exchange",
      new Error("Instagram authorization code eksik."),
      "Instagram authorization code eksik."
    );
  }

  let shortLivedAccessToken: string;
  let instagramUserId: string;
  try {
    const shortLived = await exchangeInstagramCode(code);
    shortLivedAccessToken = shortLived.accessToken;
    instagramUserId = shortLived.userId;
  } catch (error) {
    return stageFailure(
      url,
      "code-exchange",
      error,
      "Instagram code exchange başarısız."
    );
  }

  let longLivedAccessToken: string;
  try {
    const longLived = await exchangeInstagramLongLivedToken(
      shortLivedAccessToken
    );
    longLivedAccessToken = longLived.accessToken;
  } catch (error) {
    return stageFailure(
      url,
      "long-token-exchange",
      error,
      "Instagram uzun ömürlü token değişimi başarısız."
    );
  }

  let profile: Awaited<ReturnType<typeof getInstagramProfile>>;
  try {
    profile = await getInstagramProfile(
      instagramUserId,
      longLivedAccessToken
    );
  } catch (error) {
    return stageFailure(
      url,
      "profile-fetch",
      error,
      "Instagram profili alınamadı."
    );
  }

  try {
    await saveInstagramAccount(
      parsed.villa,
      profile.id,
      profile.username,
      longLivedAccessToken
    );
  } catch (error) {
    return stageFailure(
      url,
      "database-save",
      error,
      "Instagram hesabı veritabanına kaydedilemedi."
    );
  }

  const target = new URL("/sosyal", url.origin);
  target.searchParams.set("meta_connected", parsed.villa);

  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Set-Cookie":
        "ig_oauth_nonce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}
