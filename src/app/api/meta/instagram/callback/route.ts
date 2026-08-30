import {
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  getInstagramProfile,
  metaConfig,
  verifyInstagramState,
} from "@/lib/meta";
import { saveInstagramAccount } from "@/lib/meta-store";

type MetaStage =
  | "state"
  | "nonce-cookie"
  | "code-exchange"
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
      /(access_token|client_secret|authorization_code|short_lived_token|long_lived_token|code)=([^&\s]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
    .slice(0, 360);
}

function oauthCookieExpired() {
  return "ig_oauth_nonce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

async function appBaseUrl(fallback: string) {
  try {
    return (await metaConfig()).baseUrl;
  } catch {
    return fallback;
  }
}

async function errorRedirect(url: URL, stage: MetaStage, message: string) {
  const target = new URL("/sosyal", await appBaseUrl(url.origin));
  target.searchParams.set("meta_platform", "Instagram");
  target.searchParams.set("meta_error", message);
  target.searchParams.set("meta_stage", stage);

  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Set-Cookie": oauthCookieExpired(),
      "Cache-Control": "no-store",
    },
  });
}

async function stageFailure(
  url: URL,
  stage: MetaStage,
  error: unknown,
  fallback: string,
) {
  const message = safeErrorMessage(error, fallback);
  console.error(`[Instagram OAuth][${stage}] ${message}`);
  return errorRedirect(url, stage, message);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerError =
    url.searchParams.get("error") || url.searchParams.get("error_reason");

  if (providerError) {
    return stageFailure(
      url,
      "state",
      new Error("Meta OAuth isteği reddedildi."),
      "Meta OAuth isteği reddedildi.",
    );
  }

  const state = url.searchParams.get("state");
  if (!state) {
    return stageFailure(
      url,
      "state",
      new Error("OAuth state parametresi eksik."),
      "OAuth state doğrulaması başarısız.",
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
      "OAuth state doğrulaması başarısız.",
    );
  }

  if (!parsed) {
    return stageFailure(
      url,
      "state",
      new Error("OAuth state imzası geçersiz."),
      "OAuth state doğrulaması başarısız.",
    );
  }

  const nonce = cookieValue(request.headers.get("cookie"), "ig_oauth_nonce");
  if (!nonce || parsed.nonce !== nonce) {
    return stageFailure(
      url,
      "nonce-cookie",
      new Error("OAuth nonce cookie doğrulaması başarısız."),
      "OAuth nonce cookie doğrulaması başarısız.",
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return stageFailure(
      url,
      "code-exchange",
      new Error("Instagram authorization code eksik."),
      "Instagram authorization code eksik.",
    );
  }

  let shortLivedToken: Awaited<ReturnType<typeof exchangeInstagramCode>>;
  try {
    shortLivedToken = await exchangeInstagramCode(code);
  } catch (error) {
    return stageFailure(
      url,
      "code-exchange",
      error,
      "Instagram code exchange başarısız.",
    );
  }

  let longLivedToken: Awaited<
    ReturnType<typeof exchangeInstagramLongLivedToken>
  >;
  try {
    longLivedToken = await exchangeInstagramLongLivedToken(
      shortLivedToken.accessToken,
    );
  } catch (error) {
    return stageFailure(
      url,
      "code-exchange",
      error,
      "Instagram uzun ömürlü token değişimi başarısız.",
    );
  }

  let profile: Awaited<ReturnType<typeof getInstagramProfile>>;
  try {
    profile = await getInstagramProfile(longLivedToken.accessToken);
  } catch (error) {
    return stageFailure(
      url,
      "profile-fetch",
      error,
      "Instagram profili alınamadı.",
    );
  }

  try {
    await saveInstagramAccount(
      parsed.villa,
      profile.id || shortLivedToken.userId,
      profile.username,
      longLivedToken.accessToken,
      longLivedToken.expiresIn,
    );
  } catch (error) {
    return stageFailure(
      url,
      "database-save",
      error,
      "Instagram hesabı veritabanına kaydedilemedi.",
    );
  }

  const target = new URL("/sosyal", (await metaConfig()).baseUrl);
  target.searchParams.set("meta_platform", "Instagram");
  target.searchParams.set("meta_connected", parsed.villa);

  return new Response(null, {
    status: 302,
    headers: {
      Location: target.toString(),
      "Set-Cookie": oauthCookieExpired(),
      "Cache-Control": "no-store",
    },
  });
}
