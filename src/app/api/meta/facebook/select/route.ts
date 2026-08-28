import { applyFacebookBrandAssets, getFacebookPageProfile } from "@/lib/facebook";
import {
  deleteFacebookSelection,
  readFacebookSelection,
} from "@/lib/facebook-private-store";
import { saveFacebookAccount } from "@/lib/meta-store";

type Stage = "selection-validate" | "profile-fetch" | "account-save";

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

function expiredSelectionCookie() {
  return "fb_page_selection=; Path=/api/meta/facebook/select; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

function redirectError(requestUrl: string, stage: Stage, error: unknown, fallback: string) {
  const message = safeErrorMessage(error, fallback);
  console.error(`[Facebook Select][${stage}] ${message}`);
  const target = new URL("/sosyal", requestUrl);
  target.searchParams.set("meta_platform", "Facebook");
  target.searchParams.set("meta_error", message);
  target.searchParams.set("meta_stage", stage);
  return new Response(null, {
    status: 303,
    headers: {
      Location: target.toString(),
      "Set-Cookie": expiredSelectionCookie(),
    },
  });
}

export async function POST(request: Request) {
  let pageId = "";
  try {
    const form = await request.formData();
    pageId = String(form.get("pageId") ?? "").trim();
  } catch (error) {
    return redirectError(request.url, "selection-validate", error, "Facebook Sayfa seçimi okunamadı.");
  }

  const sessionId = cookieValue(request.headers.get("cookie"), "fb_page_selection");
  if (!sessionId || !pageId) {
    return redirectError(
      request.url,
      "selection-validate",
      new Error("Facebook Sayfa seçim oturumu geçersiz veya süresi dolmuş."),
      "Facebook Sayfa seçimi doğrulanamadı.",
    );
  }

  const selection = await readFacebookSelection(sessionId).catch(() => null);
  if (!selection) {
    return redirectError(
      request.url,
      "selection-validate",
      new Error("Facebook Sayfa seçim kaydı bulunamadı veya süresi dolmuş."),
      "Facebook Sayfa seçimi doğrulanamadı.",
    );
  }

  const page = selection.pages.find((candidate) => candidate.id === pageId);
  if (!page) {
    await deleteFacebookSelection(sessionId).catch(() => undefined);
    return redirectError(
      request.url,
      "selection-validate",
      new Error("Seçilen Facebook Sayfası OAuth oturumundaki izinli sayfalar arasında değil."),
      "Facebook Sayfa seçimi doğrulanamadı.",
    );
  }

  let profile: Awaited<ReturnType<typeof getFacebookPageProfile>>;
  try {
    profile = await getFacebookPageProfile(page.id, page.accessToken);
  } catch (error) {
    await deleteFacebookSelection(sessionId).catch(() => undefined);
    return redirectError(request.url, "profile-fetch", error, "Facebook Sayfa profili alınamadı.");
  }

  try {
    await saveFacebookAccount(
      selection.villa,
      profile.id,
      profile.username || profile.name,
      profile.link,
      page.accessToken,
    );
  } catch (error) {
    await deleteFacebookSelection(sessionId).catch(() => undefined);
    return redirectError(request.url, "account-save", error, "Facebook Sayfası güvenli biçimde kaydedilemedi.");
  }

  let brandState = "failed";
  try {
    const branding = await applyFacebookBrandAssets(selection.villa, profile.id, page.accessToken);
    const appliedCount = Number(branding.details.applied) + Number(branding.profile.applied) + Number(branding.cover.applied);
    brandState = appliedCount === 3 ? "applied" : appliedCount > 0 ? "partial" : "failed";
    if (branding.details.error) console.error(`[Facebook Brand][details] ${safeErrorMessage(new Error(branding.details.error), "Sayfa metinleri uygulanamadı.")}`);
    if (branding.profile.error) console.error(`[Facebook Brand][profile] ${safeErrorMessage(new Error(branding.profile.error), "Profil görseli uygulanamadı.")}`);
    if (branding.cover.error) console.error(`[Facebook Brand][cover] ${safeErrorMessage(new Error(branding.cover.error), "Kapak görseli uygulanamadı.")}`);
  } catch (error) {
    console.error(`[Facebook Brand][apply] ${safeErrorMessage(error, "Facebook marka ayarları uygulanamadı.")}`);
  }

  await deleteFacebookSelection(sessionId).catch(() => undefined);
  const target = new URL("/sosyal", request.url);
  target.searchParams.set("meta_platform", "Facebook");
  target.searchParams.set("meta_connected", selection.villa);
  target.searchParams.set("meta_brand", brandState);

  return new Response(null, {
    status: 303,
    headers: {
      Location: target.toString(),
      "Set-Cookie": expiredSelectionCookie(),
    },
  });
}
