import type { SocialPostMediaItem } from "./social-media-store";

const INSTAGRAM_GRAPH = "https://graph.instagram.com";

function publicGraphError(prefix: string, response: Response, payload: { error?: { message?: string; code?: number } }) {
  const code = payload.error?.code ? ` / ${payload.error.code}` : "";
  return `${prefix} (HTTP ${response.status}${code})`;
}

async function createContainer(accountId: string, accessToken: string, params: Record<string, string>) {
  const body = new URLSearchParams({ ...params, access_token: accessToken });
  const response = await fetch(`${INSTAGRAM_GRAPH}/${encodeURIComponent(accountId)}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string; code?: number } };
  if (!response.ok || !payload.id) throw new Error(publicGraphError("Instagram medya container oluşturulamadı", response, payload));
  return payload.id;
}

async function containerStatus(containerId: string, accessToken: string) {
  const url = new URL(`${INSTAGRAM_GRAPH}/${encodeURIComponent(containerId)}`);
  url.searchParams.set("fields", "status_code,status");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  const payload = (await response.json().catch(() => ({}))) as {
    status_code?: string;
    status?: string;
    error?: { message?: string; code?: number };
  };
  if (!response.ok) throw new Error(publicGraphError("Instagram medya işleme durumu alınamadı", response, payload));
  return String(payload.status_code ?? payload.status ?? "").toUpperCase();
}

async function waitUntilReady(containerId: string, accessToken: string, attempts = 12) {
  for (let index = 0; index < attempts; index += 1) {
    const status = await containerStatus(containerId, accessToken);
    if (["FINISHED", "PUBLISHED"].includes(status)) return;
    if (["ERROR", "EXPIRED"].includes(status)) throw new Error(`Instagram medya işleme başarısız (${status}).`);
    if (index < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error("Instagram video işleme henüz tamamlanmadı. Birkaç dakika sonra yeniden deneyin.");
}

async function publishContainer(accountId: string, accessToken: string, creationId: string) {
  const response = await fetch(`${INSTAGRAM_GRAPH}/${encodeURIComponent(accountId)}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: creationId, access_token: accessToken }),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string; code?: number } };
  if (!response.ok || !payload.id) throw new Error(publicGraphError("Instagram yayını başarısız", response, payload));
  return payload.id;
}

export async function publishInstagramSingleImage(
  accountId: string,
  accessToken: string,
  imageUrl: string,
  caption: string,
  altText?: string,
) {
  const params: Record<string, string> = { image_url: imageUrl, caption };
  if (altText) params.alt_text = altText.slice(0, 1000);
  const containerId = await createContainer(accountId, accessToken, params);
  await waitUntilReady(containerId, accessToken, 4);
  return publishContainer(accountId, accessToken, containerId);
}

export async function publishInstagramCarousel(
  accountId: string,
  accessToken: string,
  media: SocialPostMediaItem[],
  caption: string,
) {
  if (media.length < 2 || media.length > 10) throw new Error("Instagram Carousel 2 ile 10 medya arasında olmalıdır.");

  const children: string[] = [];
  for (const item of media) {
    const params: Record<string, string> = { is_carousel_item: "true" };
    if (item.kind === "video") {
      params.media_type = "VIDEO";
      params.video_url = item.mediaUrl;
    } else {
      params.image_url = item.mediaUrl;
    }
    const childId = await createContainer(accountId, accessToken, params);
    if (item.kind === "video") await waitUntilReady(childId, accessToken);
    else await waitUntilReady(childId, accessToken, 4);
    children.push(childId);
  }

  const parentId = await createContainer(accountId, accessToken, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
  });
  await waitUntilReady(parentId, accessToken, 6);
  return publishContainer(accountId, accessToken, parentId);
}

export async function publishInstagramReel(
  accountId: string,
  accessToken: string,
  videoUrl: string,
  caption: string,
) {
  const containerId = await createContainer(accountId, accessToken, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: "true",
  });
  await waitUntilReady(containerId, accessToken);
  return publishContainer(accountId, accessToken, containerId);
}

export async function publishInstagramStory(
  accountId: string,
  accessToken: string,
  media: SocialPostMediaItem,
) {
  const params: Record<string, string> = { media_type: "STORIES" };
  if (media.kind === "video") params.video_url = media.mediaUrl;
  else params.image_url = media.mediaUrl;
  const containerId = await createContainer(accountId, accessToken, params);
  await waitUntilReady(containerId, accessToken, media.kind === "video" ? 12 : 4);
  return publishContainer(accountId, accessToken, containerId);
}
