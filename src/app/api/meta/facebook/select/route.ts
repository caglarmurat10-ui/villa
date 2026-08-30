import { applyFacebookBrandAssets, getFacebookPageProfile } from "@/lib/facebook";
import {
  deleteFacebookSelection,
  readFacebookSelection,
  type FacebookPageCandidate,
} from "@/lib/facebook-private-store";
import { saveFacebookAccount } from "@/lib/meta-store";
import type { Villa } from "@/lib/types";

type Stage = "selection-validate" | "task-check" | "profile-fetch" | "account-save";

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

function validatePublishingTask(page: FacebookPageCandidate) {
  const tasks = new Set((page.tasks ?? []).map((task) => task.toUpperCase()));
  if (tasks.size > 0 && !tasks.has("CREATE_CONTENT") && !tasks.has("MANAGE")) {
    throw new Error(`Seçilen ${page.name} Sayfasında içerik yönetme görevi yok. Meta'nın döndürdüğü Page tasks: ${[...tasks].join(", ") || "yok"}. CREATE_CONTENT veya MANAGE görevi gerekir.`);
  }
}

async function profileForSave(page: FacebookPageCandidate) {
  try {
    return await getFacebookPageProfile(page.id, page.accessToken);
  } catch (error) {
    console.error(`[Facebook Select][profile-fetch-soft][${page.id}] ${safeErrorMessage(error, "Facebook profil ayrıntıları okunamadı.")}`);
    return {
      id: page.id,
      name: page.name,
      username: page.name,
      link: "",
      bio: "",
      description: "",
      coverUrl: "",
      pictureUrl: "",
    };
  }
}

async function saveMappedPage(villa: Villa, page: FacebookPageCandidate) {
  validatePublishingTask(page);
  const profile = await profileForSave(page);
  await saveFacebookAccount(
    villa,
    profile.id,
    profile.username || profile.name,
    profile.link,
    page.accessToken,
  );
  return profile;
}

async function applyBrand(villa: Villa, page: FacebookPageCandidate) {
  try {
    const branding = await applyFacebookBrandAssets(villa, page.id, page.accessToken);
    if (branding.details.error) console.error(`[Facebook Brand][${villa}][details] ${safeErrorMessage(new Error(branding.details.error), "Sayfa metinleri uygulanamadı.")}`);
    if (branding.profile.error) console.error(`[Facebook Brand][${villa}][profile] ${safeErrorMessage(new Error(branding.profile.error), "Profil görseli uygulanamadı.")}`);
    if (branding.cover.error) console.error(`[Facebook Brand][${villa}][cover] ${safeErrorMessage(new Error(branding.cover.error), "Kapak görseli uygulanamadı.")}`);
    return Number(branding.details.applied) + Number(branding.profile.applied) + Number(branding.cover.applied);
  } catch (error) {
    console.error(`[Facebook Brand][${villa}][apply] ${safeErrorMessage(error, "Facebook marka ayarları uygulanamadı.")}`);
    return 0;
  }
}

export async function POST(request: Request) {
  const sessionId = cookieValue(request.headers.get("cookie"), "fb_page_selection");
  if (!sessionId) {
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    return redirectError(request.url, "selection-validate", error, "Facebook Sayfa seçimi okunamadı.");
  }

  if (selection.mode === "all") {
    const safiraPageId = String(form.get("safiraPageId") ?? "").trim();
    const destanPageId = String(form.get("destanPageId") ?? "").trim();
    if (!safiraPageId || !destanPageId || safiraPageId === destanPageId) {
      return redirectError(
        request.url,
        "selection-validate",
        new Error("Safira ve Destan için iki farklı Facebook Sayfası seçilmelidir."),
        "Facebook Sayfa eşleştirmesi doğrulanamadı.",
      );
    }

    const safiraPage = selection.pages.find((candidate) => candidate.id === safiraPageId);
    const destanPage = selection.pages.find((candidate) => candidate.id === destanPageId);
    if (!safiraPage || !destanPage) {
      await deleteFacebookSelection(sessionId).catch(() => undefined);
      return redirectError(
        request.url,
        "selection-validate",
        new Error("Seçilen Facebook Sayfalarından biri OAuth oturumundaki izinli Sayfalar arasında değil."),
        "Facebook Sayfa eşleştirmesi doğrulanamadı.",
      );
    }

    try {
      validatePublishingTask(safiraPage);
      validatePublishingTask(destanPage);
    } catch (error) {
      await deleteFacebookSelection(sessionId).catch(() => undefined);
      return redirectError(request.url, "task-check", error, "Facebook Sayfalarında yayın yetkisi doğrulanamadı.");
    }

    try {
      await saveMappedPage("Safira", safiraPage);
      await saveMappedPage("Destan", destanPage);
    } catch (error) {
      await deleteFacebookSelection(sessionId).catch(() => undefined);
      return redirectError(request.url, "account-save", error, "Facebook Sayfaları birlikte güvenli biçimde kaydedilemedi.");
    }

    const [safiraApplied, destanApplied] = await Promise.all([
      applyBrand("Safira", safiraPage),
      applyBrand("Destan", destanPage),
    ]);
    const appliedCount = safiraApplied + destanApplied;
    const brandState = appliedCount === 6 ? "applied" : appliedCount > 0 ? "partial" : "failed";

    await deleteFacebookSelection(sessionId).catch(() => undefined);
    const target = new URL("/sosyal", request.url);
    target.searchParams.set("meta_platform", "Facebook");
    target.searchParams.set("meta_connected", "Safira ve Destan");
    target.searchParams.set("meta_brand", brandState);
    target.searchParams.set("meta_joint", "1");

    return new Response(null, {
      status: 303,
      headers: {
        Location: target.toString(),
        "Set-Cookie": expiredSelectionCookie(),
      },
    });
  }

  const pageId = String(form.get("pageId") ?? "").trim();
  if (!pageId) {
    return redirectError(
      request.url,
      "selection-validate",
      new Error("Facebook Sayfası seçilmedi."),
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

  try {
    validatePublishingTask(page);
  } catch (error) {
    await deleteFacebookSelection(sessionId).catch(() => undefined);
    return redirectError(request.url, "task-check", error, "Facebook Sayfasında yayın yetkisi doğrulanamadı.");
  }

  try {
    await saveMappedPage(selection.villa, page);
  } catch (error) {
    await deleteFacebookSelection(sessionId).catch(() => undefined);
    return redirectError(request.url, "account-save", error, "Facebook Sayfası güvenli biçimde kaydedilemedi.");
  }

  const appliedCount = await applyBrand(selection.villa, page);
  const brandState = appliedCount === 3 ? "applied" : appliedCount > 0 ? "partial" : "failed";

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
