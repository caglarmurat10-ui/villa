import type { Villa } from "./types";
import { makeInstagramState, metaConfig, verifyInstagramState } from "./meta";

const META_GRAPH_VERSION = "v26.0";
const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const FACEBOOK_AUTH = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

export { verifyInstagramState as verifyFacebookState };

function facebookRedirectUri(baseUrl: string) {
  return `${baseUrl}/api/meta/facebook/callback`;
}

export async function facebookAuthorizeUrl(villa: Villa, nonce: string) {
  const { appId, baseUrl } = await metaConfig();
  const state = await makeInstagramState(villa, nonce);
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: facebookRedirectUri(baseUrl),
    response_type: "code",
    scope: "pages_show_list,pages_read_engagement,pages_manage_posts",
    state,
    auth_type: "rerequest",
  });
  return `${FACEBOOK_AUTH}?${params.toString()}`;
}

export async function exchangeFacebookCode(code: string) {
  const { appId, appSecret, baseUrl } = await metaConfig();
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
  const { appId, appSecret } = await metaConfig();
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

type FacebookPage = {
  id: string;
  name: string;
  access_token?: string;
  tasks?: string[];
};

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gi, " ").trim();
}

export async function getFacebookPageForVilla(villa: Villa, userAccessToken: string) {
  const url = new URL(`${META_GRAPH}/me/accounts`);
  url.searchParams.set("fields", "id,name,access_token,tasks");
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", userAccessToken);

  const response = await fetch(url, { method: "GET" });
  const data = (await response.json().catch(() => ({}))) as {
    data?: FacebookPage[];
    error?: { code?: number };
  };

  if (!response.ok) {
    throw new Error(`Facebook sayfaları alınamadı (HTTP ${response.status}${data.error?.code ? ` / ${data.error.code}` : ""}).`);
  }

  const pages = (data.data ?? []).filter((page) => page.id && page.name && page.access_token);
  if (pages.length === 0) {
    throw new Error("Bu Meta hesabında yönetilebilir Facebook Sayfası bulunamadı.");
  }

  const villaName = normalize(villa);
  const matched = pages.filter((page) => normalize(page.name).includes(villaName));
  const page = matched.length === 1 ? matched[0] : pages.length === 1 ? pages[0] : null;

  if (!page?.access_token) {
    const names = pages.map((item) => item.name).slice(0, 6).join(", ");
    throw new Error(`Villa ${villa} için Facebook Sayfası otomatik eşleştirilemedi. Bulunan sayfalar: ${names}.`);
  }

  return {
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    tasks: page.tasks ?? [],
  };
}

export async function getFacebookPageProfile(pageId: string, pageAccessToken: string) {
  const url = new URL(`${META_GRAPH}/${encodeURIComponent(pageId)}`);
  url.searchParams.set("fields", "id,name,username,link");
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url, { method: "GET" });
  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    username?: string;
    link?: string;
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
  };
}

export async function publishFacebookPost(
  pageId: string,
  pageAccessToken: string,
  message: string,
  imageUrl?: string,
) {
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

  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    post_id?: string;
    error?: { code?: number };
  };

  if (!response.ok || (!data.id && !data.post_id)) {
    throw new Error(`Facebook yayını başarısız (HTTP ${response.status}${data.error?.code ? ` / ${data.error.code}` : ""}).`);
  }

  return data.post_id ?? data.id!;
}
