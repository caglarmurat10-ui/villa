import {
  INSTAGRAM_LIBRARY_PREFIX,
  INSTAGRAM_MEDIA_PREFIX,
} from "@/lib/instagramTokenStore";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type MediaMetadata = {
  contentType?: string;
  cacheControl?: string;
  size?: number;
};

type MediaRouteContext = { params: Promise<{ key: string[] }> };

function mediaHeaders(metadata: MediaMetadata | null, size?: number) {
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control":
      metadata?.cacheControl || "public, max-age=86400, immutable",
    "x-content-type-options": "nosniff",
  });
  if (metadata?.contentType) {
    headers.set("content-type", metadata.contentType);
  }
  if (typeof size === "number") {
    headers.set("content-length", String(size));
  }
  return headers;
}

function byteRange(value: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;

  let start = match[1] ? Number(match[1]) : Number.NaN;
  let end = match[2] ? Number(match[2]) : Number.NaN;

  if (Number.isNaN(start)) {
    const suffixLength = end;
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    if (!Number.isInteger(start) || start < 0 || start >= size) return null;
    if (Number.isNaN(end)) end = size - 1;
  }

  if (!Number.isInteger(end) || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

async function serveMedia(
  request: Request,
  context: MediaRouteContext,
  headOnly: boolean,
) {
  const { key } = await context.params;
  const objectKey = key.join("/");

  if (
    (!objectKey.startsWith(INSTAGRAM_MEDIA_PREFIX) &&
      !objectKey.startsWith(INSTAGRAM_LIBRARY_PREFIX)) ||
    objectKey.includes("..")
  ) {
    return new Response("Not found", { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const object = await env.SOCIAL_MEDIA_KV.getWithMetadata<MediaMetadata>(
      objectKey,
      "arrayBuffer",
    );
    if (!object.value) return new Response("Not found", { status: 404 });

    const contentType = object.metadata?.contentType;
    if (contentType !== "image/jpeg" && contentType !== "video/mp4") {
      return new Response("Not found", { status: 404 });
    }

    const size = object.value.byteLength;
    const range = byteRange(rangeHeader, size);
    if (!range) {
      const headers = mediaHeaders(object.metadata, 0);
      headers.set("content-range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }

    const length = range.end - range.start + 1;
    const headers = mediaHeaders(object.metadata, length);
    headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
    return new Response(
      headOnly ? null : object.value.slice(range.start, range.end + 1),
      { status: 206, headers },
    );
  }

  const object = await env.SOCIAL_MEDIA_KV.getWithMetadata<MediaMetadata>(
    objectKey,
    "arrayBuffer",
  );
  if (!object.value) return new Response("Not found", { status: 404 });

  const contentType = object.metadata?.contentType;
  if (contentType !== "image/jpeg" && contentType !== "video/mp4") {
    return new Response("Not found", { status: 404 });
  }

  const headers = mediaHeaders(object.metadata, object.metadata?.size);
  if (headOnly) {
    return new Response(null, { status: 200, headers });
  }

  return new Response(object.value, { status: 200, headers });
}

export async function GET(
  request: Request,
  context: MediaRouteContext,
) {
  return serveMedia(request, context, false);
}

export async function HEAD(request: Request, context: MediaRouteContext) {
  return serveMedia(request, context, true);
}
