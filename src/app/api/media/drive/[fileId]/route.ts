import { resolveDriveMediaById } from "@/lib/social-drive-media";

export const dynamic = "force-dynamic";

async function fetchImage(url: string) {
  return fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/jpeg,image/png,image/*,*/*;q=0.8",
      "User-Agent": "VillaYonetim-MediaProxy/1.0",
    },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  const asset = resolveDriveMediaById(fileId);
  if (!asset) return new Response("Medya bulunamadı.", { status: 404 });

  let upstream = await fetchImage(asset.sourceUrl);
  let contentType = upstream.headers.get("content-type") ?? "";

  if (!upstream.ok || !contentType.startsWith("image/")) {
    upstream = await fetchImage(asset.previewUrl.replace("sz=w1600", "sz=w2400"));
    contentType = upstream.headers.get("content-type") ?? "";
  }

  if (!upstream.ok || !contentType.startsWith("image/") || !upstream.body) {
    console.error(`[Drive Media Proxy] ${asset.villa}/${asset.fileName} alınamadı (HTTP ${upstream.status}).`);
    return new Response("Drive medyası alınamadı.", { status: 502 });
  }

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
    "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
    "X-Content-Type-Options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new Response(upstream.body, { status: 200, headers });
}
