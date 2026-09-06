import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Villa } from "./types";
import type { FacebookPageCandidate } from "./facebook-private-store";
import { brandProfiles } from "./brand-profiles";
import { renderProfileImage } from "./social-brand-images";

const META_GRAPH_VERSION = "v26.0";
const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const FACEBOOK_AUTH = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

export const REQUIRED_FACEBOOK_PERMISSIONS = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_metadata",
  // Page.instagram_business_account / Page.connected_instagram_account alanlarını okumak için
  // Meta Graph API v26 (Facebook Login for Business) bu izni ayrıca gerektirir. pages_* izinleri
  // tek başına bu ilişkiyi görünür kılmaz. Bkz. src/lib/facebook-instagram-relationship.ts.
  "instagram_basic",
] as const;

async function facebookConfig() {
  const { env } = await getCloudflareContext({ async: true });
  const appId = env.FACEBOOK_APP_ID ?? process.env.FACEBOOK_APP_ID;
  const appSecret = env.FACEBOOK_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET;
  const configId = env.FACEBOOK_CONFIG_ID ?? process.env.FACEBOOK_CONFIG_ID;
  const baseUrl = env.APP_BASE_URL ?? process.env.APP_BASE_URL;

  if (!appId) throw new Error("Eksik ortam değişkeni: FACEBOOK_APP_ID. Instagram App ID Facebook Login için kullanılamaz.");
  if (!appSecret) throw new Error("Eksik ortam değişkeni: FACEBOOK_APP_SECRET.");
  if (!configId) throw new Error("Eksik ortam değişkeni: FACEBOOK_CONFIG_ID. Meta Developer > Facebook İşletme Girişi > Yapılandırmalar bölümünden bir yapılandırma oluşturun.");
  if (!baseUrl) throw new Error("Eksik ortam değişkeni: APP_BASE_URL.");

  return { appId, appSecret, configId, baseUrl: baseUrl.replace(/\/$/, "") };
}

function facebookRedirectUri(baseUrl: string) {
  return `${baseUrl}/api/meta/facebook/callback`;
}

async function signFacebookState(villa: Villa, nonce: string) {
  const { appSecret } = await facebookConfig();
  const payload = `${villa}.${nonce}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return `${payload}.${Array.from(signature).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function verifyFacebookState(state: string) {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [villa, nonce, signature] = parts;
  if (villa !== "Safira" && villa !== "Destan") return null;
  if (!/^[a-f0-9]{64}$/.test(signature)) return null;
  const expected = await signFacebookState(villa, nonce);
  if (expected !== state) return null;
  return { villa: villa as Villa, nonce };
}

export async function facebookAuthorizeUrl(villa: Villa, nonce: string) {
  const { appId, configId, baseUrl } = await facebookConfig();
  const state = await signFacebookState(villa, nonce);
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: facebookRedirectUri(baseUrl),
    response_type: "code",
    config_id: configId,
    override_default_response_type: "true",
    state,
    auth_type: "rerequest",
  });
  return `${FACEBOOK_AUTH}?${params.toString()}`;
}

export async function exchangeFacebookCode(code: string) {
  const { appId, appSecret, baseUrl } = await facebookConfig();
  const url = new URL(`${META_GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", facebookRedirectUri(baseUrl));
  url.searchParams.set("code", code);

  const response = await fetch(url, { method: "GET" });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string; code?: number };
  };

  if (!response.ok || !data.access_token) {
    throw new Error(`Facebook code exchange başarısız (HTTP ${response.status}${data.error?.code ? ` / ${data.error.code}` : ""}).`);
  }

  return { accessToken: data.access_token, expiresIn: data.expires_in ?? null };
}

export async function exchangeFacebookLongLivedToken(shortLivedAccessToken: string) {
  const { appId, appSecret } = await facebookConfig();
  const url = new URL(`${META_GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedAccessToken);

  const response = await fetch(url, { method: "GET" });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { code?: number };
  };

  if (!response.ok || !data.access_token) {
    throw new Error(`Facebook uzun ömürlü token değişimi başarısız (HTTP ${response.status}${data.error?.code ? ` / ${data.error.code}` : ""}).`);
  }

  return { accessToken: data.access_token, expiresIn: data.expires_in ?? null };
}

export async function getFacebookPermissionStatus(userAccessToken: string) {
  const url = new URL(`${META_GRAPH}/me/permissions`);
  url.searchParams.set("access_token", userAccessToken);
  const response = await fetch(url, { method: "GET" });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: Array<{ permission?: string; status?: string }>;
    error?: { code?: number };
  };
  if (!response.ok) {
    throw new Error(`Facebook izin durumu alınamadı (HTTP ${response.status}${payload.error?.code ? ` / ${payload.error.code}` : ""}).`);
  }
  const statuses = new Map((payload.data ?? []).filter((row) => row.permission).map((row) => [row.permission!, row.status ?? "unknown"]));
  const granted = REQUIRED_FACEBOOK_PERMISSIONS.filter((permission) => statuses.get(permission) === "granted");
  const missing = REQUIRED_FACEBOOK_PERMISSIONS.filter((permission) => statuses.get(permission) !== "granted");
  return { granted, missing, complete: missing.length === 0 };
}

export async function getFacebookTokenScopes(inputToken: string) {
  const { appId, appSecret } = await facebookConfig();
  const url = new URL(`${META_GRAPH}/debug_token`);
  url.searchParams.set("input_token", inputToken);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);
  const response = await fetch(url, { method: "GET" });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: { is_valid?: boolean; scopes?: string[] };
    error?: { code?: number };
  };
  if (!response.ok || !payload.data) {
    throw new Error(`Facebook token izin bilgisi alınamadı (HTTP ${response.status}${payload.error?.code ? ` / ${payload.error.code}` : ""}).`);
  }
  return {
    valid: Boolean(payload.data.is_valid),
    scopes: Array.isArray(payload.data.scopes) ? payload.data.scopes : [],
  };
}

type FacebookPageApi = {
  id: string;
  name: string;
  access_token?: string;
  tasks?: string[];
};

export async function getFacebookPages(userAccessToken: string): Promise<FacebookPageCandidate[]> {
  const url = new URL(`${META_GRAPH}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,tasks");
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", userAccessToken);

  const response = await fetch(url, { method: "GET" });
  const data = (await response.json().catch(() => ({}))) as {
    data?: FacebookPageApi[];
    error?: { code?: number };
  };

  if (!response.ok) {
    throw new Error(`Facebook sayfaları alınamadı (HTTP ${response.status}${data.error?.code ? ` / ${data.error.code}` : ""}).`);
  }

  const pages = (data.data ?? [])
    .filter((page) => page.id && page.name && page.access_token)
    .map((page) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token!,
      tasks: page.tasks ?? [],
    }));

  if (pages.length === 0) {
    throw new Error("Bu Meta hesabında yönetilebilir Facebook Sayfası bulunamadı.");
  }

  return pages;
}

export async function getFacebookPageProfile(pageId: string, pageAccessToken: string) {
  const url = new URL(`${META_GRAPH}/${encodeURIComponent(pageId)}`);
  url.searchParams.set("fields", "id,name,username,link,bio,description,cover,picture.type(large)");
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url, { method: "GET" });
  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    username?: string;
    link?: string;
    bio?: string;
    description?: string;
    cover?: { source?: string };
    picture?: { data?: { url?: string } };
    error?: { code?: number };
  };

  if (!response.ok || !data.id) {
    throw new Error(`Facebook Sayfa profili alınamadı (HTTP ${response.status}${data.error?.code ? ` / ${data.error.code}` : ""}).`);
  }

  return {
    id: data.id,
    name: data.name ?? "Facebook Sayfası",
    username: data.username ?? data.name ?? "facebook",
    link: data.link ?? "",
    bio: data.bio ?? "",
    description: data.description ?? "",
    coverUrl: data.cover?.source ?? "",
    pictureUrl: data.picture?.data?.url ?? "",
  };
}

async function graphPost(path: string, body: URLSearchParams) {
  const response = await fetch(`${META_GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    success?: boolean;
    error?: { code?: number; message?: string };
  };
  return { response, data };
}

export type FacebookBrandApplyResult = {
  details: { applied: boolean; error?: string };
  profile: { applied: boolean; error?: string };
  cover: { applied: boolean; error?: string };
};

function publicGraphError(prefix: string, response: Response, data: { error?: { code?: number } }) {
  return `${prefix} (HTTP ${response.status}${data.error?.code ? ` / ${data.error.code}` : ""})`;
}

async function uploadFacebookImage(
  pageId: string,
  pageAccessToken: string,
  path: string,
  image: Response,
  fields: Record<string, string>,
) {
  const imageBlob = await image.blob();
  const form = new FormData();
  form.set("access_token", pageAccessToken);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set("source", imageBlob, "image.png");
  const response = await fetch(`${META_GRAPH}/${encodeURIComponent(pageId)}/${path}`, { method: "POST", body: form });
  const data = (await response.json().catch(() => ({}))) as { id?: string; success?: boolean; error?: { code?: number; message?: string } };
  return { response, data };
}

export async function applyFacebookBrandAssets(
  villa: Villa,
  pageId: string,
  pageAccessToken: string,
): Promise<FacebookBrandApplyResult> {
  const { baseUrl } = await facebookConfig();
  const brand = brandProfiles[villa].facebook;
  const coverUrl = `${baseUrl}/api/social-assets/${villa}/cover`;
  const result: FacebookBrandApplyResult = {
    details: { applied: false },
    profile: { applied: false },
    cover: { applied: false },
  };

  {
    // `bio` ve `description` ayrı ayrı gönderiliyor: Meta bazı Sayfa kategorilerinde bu alanlardan
    // yalnızca birini kabul edebiliyor - tek bir birleşik POST'ta biri reddedilirse ikisi de
    // uygulanmıyordu. Ayırınca en azından geçerli olan alan uygulanabiliyor; hangisinin
    // reddedildiği de ayrı ayrı loglanıyor.
    let bioApplied = false;
    let descriptionApplied = false;
    const errors: string[] = [];

    try {
      const bioBody = new URLSearchParams({ access_token: pageAccessToken, bio: brand.intro });
      const updated = await graphPost(encodeURIComponent(pageId), bioBody);
      if (updated.response.ok && (updated.data.success === true || Boolean(updated.data.id))) bioApplied = true;
      else {
        errors.push(publicGraphError("bio", updated.response, updated.data));
        console.error(`[Facebook Brand][${villa}][details][bio] ${updated.data.error?.message ?? "mesaj yok"}`);
      }
    } catch (error) {
      errors.push("bio uygulanamadı");
      console.error(`[Facebook Brand][${villa}][details][bio][exception] ${error instanceof Error ? error.message : "bilinmeyen"}`);
    }

    try {
      const descriptionBody = new URLSearchParams({ access_token: pageAccessToken, description: brand.about });
      const updated = await graphPost(encodeURIComponent(pageId), descriptionBody);
      if (updated.response.ok && (updated.data.success === true || Boolean(updated.data.id))) descriptionApplied = true;
      else {
        errors.push(publicGraphError("description", updated.response, updated.data));
        console.error(`[Facebook Brand][${villa}][details][description] ${updated.data.error?.message ?? "mesaj yok"}`);
      }
    } catch (error) {
      errors.push("description uygulanamadı");
      console.error(`[Facebook Brand][${villa}][details][description][exception] ${error instanceof Error ? error.message : "bilinmeyen"}`);
    }

    result.details.applied = bioApplied && descriptionApplied;
    if (!result.details.applied) result.details.error = `Facebook Hakkında alanları uygulanamadı (${errors.join("; ")})`;
  }

  try {
    // Meta'nın /{page-id}/picture ucu `url` parametresiyle çağrıldığında kendi sunucusundan görseli
    // çekmeye çalışıyor ve gözlemlenen davranışta bunu güvenilir biçimde yapamıyor - "(#1) Could not
    // fetch picture" hatasıyla reddediyor (canlıda doğrulandı: URL bizim tarafımızdan hem GET hem
    // HEAD ile sorunsuz erişilebiliyor). Görseli Meta'ya URL vermek yerine doğrudan render edip
    // (self-fetch YOK - Cloudflare Workers'ta bir Worker'ın kendi alan adına HTTP isteği atması
    // güvenilir değil, HTTP 522 canlıda gözlemlendi) binary olarak yüklüyoruz.
    const { response, data } = await uploadFacebookImage(pageId, pageAccessToken, "picture", renderProfileImage(villa), { no_feed_story: "true" });
    if (response.ok && (data.success === true || Boolean(data.id))) result.profile.applied = true;
    else {
      result.profile.error = publicGraphError("Facebook profil fotoğrafı uygulanamadı", response, data);
      console.error(`[Facebook Brand][${villa}][profile] ${data.error?.message ?? "mesaj yok"}`);
    }
  } catch (error) {
    result.profile.error = "Facebook profil fotoğrafı uygulanamadı.";
    console.error(`[Facebook Brand][${villa}][profile][exception] ${error instanceof Error ? error.message : "bilinmeyen"}`);
  }

  try {
    // Kapak görseli, profil görselinin aksine, doğrudan render edilip binary yüklenmiyor: kapak
    // render'ı (dış Google Drive görselini çekip 1640x924 üzerine bindiriyor) tek başına bile
    // zaman zaman Cloudflare Workers CPU süresi limitini zorluyor ("Exceeded CPU Limit", canlıda
    // doğrulandı) - bunu profil render'ı ve iki Graph API çağrısıyla AYNI istekte yapmak
    // isteği güvenilir biçimde limitin üstüne taşıdı (canlıda doğrulandı). Meta'ya URL vererek
    // Meta'nın kendi (ayrı) isteğiyle çektirmek, render CPU maliyetini bu isteğin dışına, ayrı bir
    // Worker çağrısına taşıyor - /{page-id}/photos ucu bu URL akışını (profilden farklı olarak)
    // güvenilir kabul ediyor.
    const uploadBody = new URLSearchParams({ access_token: pageAccessToken, url: coverUrl, published: "false", no_story: "true" });
    const upload = await graphPost(`${encodeURIComponent(pageId)}/photos`, uploadBody);
    if (!upload.response.ok || !upload.data.id) {
      result.cover.error = publicGraphError("Facebook kapak görseli yüklenemedi", upload.response, upload.data);
      console.error(`[Facebook Brand][${villa}][cover] ${upload.data.error?.message ?? "mesaj yok"}`);
    } else {
      const applyBody = new URLSearchParams({ access_token: pageAccessToken, cover: upload.data.id, offset_y: "50", no_feed_story: "true" });
      const applied = await graphPost(encodeURIComponent(pageId), applyBody);
      if (applied.response.ok && (applied.data.success === true || Boolean(applied.data.id))) result.cover.applied = true;
      else result.cover.error = publicGraphError("Facebook kapak görseli uygulanamadı", applied.response, applied.data);
    }
  } catch (error) {
    result.cover.error = "Facebook kapak görseli uygulanamadı.";
    console.error(`[Facebook Brand][${villa}][cover][exception] ${error instanceof Error ? error.message : "bilinmeyen"}`);
  }

  return result;
}

export async function publishFacebookPost(pageId: string, pageAccessToken: string, message: string, imageUrl?: string) {
  const endpoint = imageUrl ? `${META_GRAPH}/${pageId}/photos` : `${META_GRAPH}/${pageId}/feed`;
  const body = new URLSearchParams({ access_token: pageAccessToken });
  if (imageUrl) {
    body.set("url", imageUrl);
    body.set("caption", message);
    body.set("published", "true");
  } else {
    body.set("message", message);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await response.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { code?: number } };
  if (!response.ok || (!data.id && !data.post_id)) {
    throw new Error(`Facebook yayını başarısız (HTTP ${response.status}${data.error?.code ? ` / ${data.error.code}` : ""}).`);
  }

  return data.post_id ?? data.id!;
}
