import type { Villa } from "./types";
import type { FacebookPageCandidate } from "./facebook-private-store";
import { brandProfiles } from "./brand-profiles";
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
    scope: "pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata",
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

export async function applyFacebookBrandAssets(
  villa: Villa,
  pageId: string,
  pageAccessToken: string,
): Promise<FacebookBrandApplyResult> {
  const { baseUrl } = await metaConfig();
  const brand = brandProfiles[villa].facebook;
  const profileUrl = `${baseUrl}/api/social-assets/${villa}/profile`;
  const coverUrl = `${baseUrl}/api/social-assets/${villa}/cover`;
  const result: FacebookBrandApplyResult = {
    details: { applied: false },
    profile: { applied: false },
    cover: { applied: false },
  };

  // Only sync safe, source-controlled text fields. Page name, username, category,
  // phone and website are intentionally not changed automatically.
  try {
    const detailBody = new URLSearchParams({
      access_token: pageAccessToken,
      bio: brand.intro,
      description: brand.about,
    });
    const updated = await graphPost(encodeURIComponent(pageId), detailBody);
    if (updated.response.ok && (updated.data.success === true || Boolean(updated.data.id))) {
      result.details.applied = true;
    } else {
      result.details.error = publicGraphError("Facebook Hakkında alanları uygulanamadı", updated.response, updated.data);
    }
  } catch {
    result.details.error = "Facebook Hakkında alanları uygulanamadı.";
  }

  try {
    const body = new URLSearchParams({
      access_token: pageAccessToken,
      url: profileUrl,
      no_feed_story: "true",
    });
    const { response, data } = await graphPost(`${encodeURIComponent(pageId)}/picture`, body);
    if (response.ok && (data.success === true || Boolean(data.id))) {
      result.profile.applied = true;
    } else {
      result.profile.error = publicGraphError("Facebook profil fotoğrafı uygulanamadı", response, data);
    }
  } catch {
    result.profile.error = "Facebook profil fotoğrafı uygulanamadı.";
  }

  try {
    const uploadBody = new URLSearchParams({
      access_token: pageAccessToken,
      url: coverUrl,
      published: "false",
      no_story: "true",
    });
    const upload = await graphPost(`${encodeURIComponent(pageId)}/photos`, uploadBody);
    if (!upload.response.ok || !upload.data.id) {
      result.cover.error = publicGraphError("Facebook kapak görseli yüklenemedi", upload.response, upload.data);
    } else {
      const applyBody = new URLSearchParams({
        access_token: pageAccessToken,
        cover: upload.data.id,
        offset_y: "50",
        no_feed_story: "true",
      });
      const applied = await graphPost(encodeURIComponent(pageId), applyBody);
      if (applied.response.ok && (applied.data.success === true || Boolean(applied.data.id))) {
        result.cover.applied = true;
      } else {
        result.cover.error = publicGraphError("Facebook kapak görseli uygulanamadı", applied.response, applied.data);
      }
    }
  } catch {
    result.cover.error = "Facebook kapak görseli uygulanamadı.";
  }

  return result;
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
