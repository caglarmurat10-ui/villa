import {
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  getInstagramProfile,
  verifyInstagramState,
} from "@/lib/meta";
import { saveInstagramAccount } from "@/lib/meta-store";

type MetaStage =
  | "state"
  | "nonce-cookie"
  | "code-exchange"
  | "profile-fetch"
  | "database-save";

const stageMessages: Record<MetaStage, string> = {
  state: "Meta güvenlik doğrulaması başarısız.",
  "nonce-cookie": "Instagram güvenlik çerezi doğrulanamadı.",
  "code-exchange": "Instagram erişim anahtarı alınamadı.",
  "profile-fetch": "Instagram profili alınamadı.",
  "database-save": "Instagram hesabı kaydedilemedi.",
};

function cookieValue(header: string | null, name: string) {
  if (!header) return "";
  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function oauthCookieExpired() {
  return "ig_oauth_nonce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function failureResponse(
  requestUrl: URL,
  stage: MetaStage,
  message = stageMessages[stage],
) {
  console.error(`[meta-instagram:${stage}] ${message}`);

  const redirectUrl = new URL("/sosyal", requestUrl.origin);
  redirectUrl.searchParams.set("meta_error", message);
  redirectUrl.searchParams.set("meta_stage", stage);

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl.toString(),
      "Set-Cookie": oauthCookieExpired(),
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerError =
    url.searchParams.get("error") || url.searchParams.get("error_reason");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (providerError) {
    return failureResponse(
      url,
      "code-exchange",
      "Instagram yetkilendirmesi tamamlanamadı.",
    );
  }

  if (!state) {
    return failureResponse(url, "state", "Meta state bilgisi eksik.");
  }

  if (!code) {
    return failureResponse(
      url,
      "code-exchange",
      "Instagram yetkilendirme kodu eksik.",
    );
  }

  let parsed: Awaited<ReturnType<typeof verifyInstagramState>>;
  try {
    parsed = await verifyInstagramState(state);
  } catch {
    return failureResponse(url, "state");
  }

  if (!parsed) {
    return failureResponse(url, "state");
  }

  const nonce = cookieValue(request.headers.get("cookie"), "ig_oauth_nonce");
  if (!nonce || parsed.nonce !== nonce) {
    return failureResponse(url, "nonce-cookie");
  }

  let shortLivedToken: Awaited<ReturnType<typeof exchangeInstagramCode>>;
  let longLivedToken: Awaited<
    ReturnType<typeof exchangeInstagramLongLivedToken>
  >;

  try {
    shortLivedToken = await exchangeInstagramCode(code);
    longLivedToken = await exchangeInstagramLongLivedToken(
      shortLivedToken.accessToken,
    );
  } catch {
    return failureResponse(url, "code-exchange");
  }

  let profile: Awaited<ReturnType<typeof getInstagramProfile>>;
  try {
    profile = await getInstagramProfile(longLivedToken.accessToken);
  } catch {
    return failureResponse(url, "profile-fetch");
  }

  try {
    await saveInstagramAccount(
      parsed.villa,
      profile.id || shortLivedToken.userId,
      profile.username,
      longLivedToken.accessToken,
    );
  } catch {
    return failureResponse(url, "database-save");
  }

  const redirectUrl = new URL("/sosyal", url.origin);
  redirectUrl.searchParams.set("meta_connected", parsed.villa);

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl.toString(),
      "Set-Cookie": oauthCookieExpired(),
    },
  });
}
