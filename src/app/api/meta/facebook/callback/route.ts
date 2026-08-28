import {
  exchangeFacebookCode,
  exchangeFacebookLongLivedToken,
  getFacebookPageForVilla,
  getFacebookPageProfile,
  verifyFacebookState,
} from "@/lib/facebook";
import { saveFacebookAccount } from "@/lib/meta-store";

type MetaStage =
  | "state"
  | "nonce-cookie"
  | "code-exchange"
  | "page-fetch"
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
      /(access_token|client_secret|authorization_code|short_lived_token|long_lived_token|code|fb_exchange_token)=([^&\s]+)/gi,
      "$1=[REDACTED]",
    )
    .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
    .slice(0, 420);
}

function expiredCookie() {
  return "fb_oauth_nonce=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function redirectError(url: URL, stage: MetaStage, error: unknown, fallback: string) {
  const message = safeErrorMessage(error, fallback);
  console.error(`[Facebook OAuth][${stage}] ${message}`);
  const target = new URL("/sosyal", url.origin);
  target.searchParams.set("meta_platform", "Facebook");
  target.searchParams.set("meta_error", message);
  target.searchParams.set("meta_stage", stage);
  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), "Set-Cookie": expiredCookie() },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const providerError = url.searchParams.get("error") || url.searchParams.get("error_reason");
  if (providerError) {
    return redirectError(url, "state", new Error("Facebook yetkilendirmesi reddedildi."), "Facebook yetkilendirmesi tamamlanamadı.");
  }

  const state = url.searchParams.get("state");
  if (!state) return redirectError(url, "state", new Error("OAuth state parametresi eksik."), "Facebook state doğrulaması başarısız.");

  let parsed: Awaited<ReturnType<typeof verifyFacebookState>>;
  try {
    parsed = await verifyFacebookState(state);
  } catch (error) {
    return redirectError(url, "state", error, "Facebook state doğrulaması başarısız.");
  }
  if (!parsed) return redirectError(url, "state", new Error("OAuth state imzası geçersiz."), "Facebook state doğrulaması başarısız.");

  const nonce = cookieValue(request.headers.get("cookie"), "fb_oauth_nonce");
  if (!nonce || parsed.nonce !== nonce) {
    return redirectError(url, "nonce-cookie", new Error("OAuth nonce cookie doğrulaması başarısız."), "Facebook güvenlik çerezi doğrulanamadı.");
  }

  const code = url.searchParams.get("code");
  if (!code) return redirectError(url, "code-exchange", new Error("Facebook authorization code eksik."), "Facebook yetkilendirme kodu eksik.");

  let userAccessToken: string;
  try {
    const shortLived = await exchangeFacebookCode(code);
    const longLived = await exchangeFacebookLongLivedToken(shortLived.accessToken);
    userAccessToken = longLived.accessToken;
  } catch (error) {
    return redirectError(url, "code-exchange", error, "Facebook erişim anahtarı alınamadı.");
  }

  let page: Awaited<ReturnType<typeof getFacebookPageForVilla>>;
  try {
    page = await getFacebookPageForVilla(parsed.villa, userAccessToken);
  } catch (error) {
    return redirectError(url, "page-fetch", error, "Villa için Facebook Sayfası bulunamadı.");
  }

  let profile: Awaited<ReturnType<typeof getFacebookPageProfile>>;
  try {
    profile = await getFacebookPageProfile(page.id, page.accessToken);
  } catch (error) {
    return redirectError(url, "profile-fetch", error, "Facebook Sayfa profili alınamadı.");
  }

  try {
    await saveFacebookAccount(parsed.villa, profile.id, profile.username || profile.name, profile.link, page.accessToken);
  } catch (error) {
    return redirectError(url, "database-save", error, "Facebook Sayfası kaydedilemedi.");
  }

  const target = new URL("/sosyal", url.origin);
  target.searchParams.set("meta_platform", "Facebook");
  target.searchParams.set("meta_connected", parsed.villa);

  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), "Set-Cookie": expiredCookie() },
  });
}
