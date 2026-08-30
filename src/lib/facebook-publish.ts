const META_GRAPH_VERSION = "v26.0";
const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

function graphError(prefix: string, response: Response, payload: { error?: { code?: number } }) {
  return `${prefix} (HTTP ${response.status}${payload.error?.code ? ` / ${payload.error.code}` : ""}).`;
}

export async function publishFacebookPhotoCarousel(
  pageId: string,
  pageAccessToken: string,
  caption: string,
  imageUrls: string[],
) {
  if (imageUrls.length < 2 || imageUrls.length > 10) throw new Error("Facebook Carousel 2 ile 10 görsel arasında olmalıdır.");
  const photoIds: string[] = [];

  for (const imageUrl of imageUrls) {
    const response = await fetch(`${META_GRAPH}/${encodeURIComponent(pageId)}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        access_token: pageAccessToken,
        url: imageUrl,
        published: "false",
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { code?: number } };
    if (!response.ok || !payload.id) throw new Error(graphError("Facebook Carousel görseli yüklenemedi", response, payload));
    photoIds.push(payload.id);
  }

  const body = new URLSearchParams({ access_token: pageAccessToken, message: caption });
  photoIds.forEach((id, index) => body.set(`attached_media[${index}]`, JSON.stringify({ media_fbid: id })));
  const response = await fetch(`${META_GRAPH}/${encodeURIComponent(pageId)}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { code?: number } };
  if (!response.ok || !payload.id) throw new Error(graphError("Facebook Carousel yayını başarısız", response, payload));
  return payload.id;
}

export async function publishFacebookReel(
  pageId: string,
  pageAccessToken: string,
  videoUrl: string,
  description: string,
) {
  const start = await fetch(`${META_GRAPH}/${encodeURIComponent(pageId)}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageAccessToken,
      upload_phase: "start",
    }),
  });
  const started = (await start.json().catch(() => ({}))) as {
    video_id?: string;
    upload_url?: string;
    error?: { code?: number };
  };
  if (!start.ok || !started.video_id || !started.upload_url) {
    throw new Error(graphError("Facebook Reels yükleme oturumu başlatılamadı", start, started));
  }

  const upload = await fetch(started.upload_url, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${pageAccessToken}`,
      file_url: videoUrl,
    },
  });
  const uploaded = (await upload.json().catch(() => ({}))) as { success?: boolean; error?: { code?: number } };
  if (!upload.ok || uploaded.success === false) {
    throw new Error(graphError("Facebook Reels videosu yüklenemedi", upload, uploaded));
  }

  const finish = await fetch(`${META_GRAPH}/${encodeURIComponent(pageId)}/video_reels`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: pageAccessToken,
      video_id: started.video_id,
      upload_phase: "finish",
      video_state: "PUBLISHED",
      description,
    }),
  });
  const finished = (await finish.json().catch(() => ({}))) as { success?: boolean; id?: string; error?: { code?: number } };
  if (!finish.ok || finished.success === false) {
    throw new Error(graphError("Facebook Reels yayını tamamlanamadı", finish, finished));
  }
  return finished.id ?? started.video_id;
}
