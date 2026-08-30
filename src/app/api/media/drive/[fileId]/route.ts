import { resolveDriveMediaById } from "@/lib/social-drive-media";

export const dynamic = "force-dynamic";

async function fetchMedia(url: string, kind: "image" | "video", range?: string | null) {
  const headers: Record<string, string> = {
    Accept: kind === "video" ? "video/*,application/octet-stream;q=0.9,*/*;q=0.5" : "image/avif,image/webp,image/jpeg,image/png,image/*,*/*;q=0.8",
    "User-Agent": "VillaYonetim-MediaProxy/2.0",
  };
  if (range) headers.Range = range;
  return fetch(url, { method: "GET", redirect: "follow", headers });
}

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  const asset = resolveDriveMediaById(fileId);
  if (!asset) return new Response("Medya bulunamadı.", { status: 404 });

  const range = request.headers.get("range");
  let upstream = await fetchMedia(asset.sourceUrl, asset.mediaKind, range);
  let contentType = upstream.headers.get("content-type") ?? "";

  if (asset.mediaKind === "image" && (!upstream.ok || !contentType.startsWith("image/"))) {
    upstream = await fetchMedia(asset.previewUrl.replace("sz=w1600", "sz=w2400"), "image");
    contentType = upstream.headers.get("content-type") ?? "";
  }

  const validType = asset.mediaKind === "video"
    ? (contentType.startsWith("video/") || contentType === "application/octet-stream")
    : contentType.startsWith("image/");

  if (!upstream.ok || !validType || !upstream.body) {
    console.error(`[Drive Media Proxy] ${asset.villa}/${asset.fileName} alınamadı (HTTP ${upstream.status}).`);
    return new Response("Drive medyası alınamadı.", { status: 502 });
  }

  const headers = new Headers({
    "Content-Type": contentType || (asset.mediaKind === "video" ? "video/mp4" : "image/jpeg"),
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
    "Cache-Control": asset.mediaKind === "video" ? "public, max-age=3600, s-maxage=86400" : "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": upstream.headers.get("accept-ranges") ?? "bytes",
  });
  for (const key of ["content-length", "content-range", "etag", "last-modified"]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }

  return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
}
