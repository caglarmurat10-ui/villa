import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type StoredObject = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  httpEtag?: string;
  httpMetadata?: {
    contentType?: string;
    contentLanguage?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    cacheControl?: string;
    cacheExpiry?: Date;
  };
};

type MediaBucket = {
  get: (key: string) => Promise<StoredObject | null>;
};

type MediaEnv = {
  SOCIAL_MEDIA?: MediaBucket;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const objectKey = key.join("/");

  if (!objectKey || objectKey.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const mediaEnv = env as unknown as MediaEnv;

  if (!mediaEnv.SOCIAL_MEDIA) {
    return new Response("Media storage unavailable", { status: 503 });
  }

  const object = await mediaEnv.SOCIAL_MEDIA.get(objectKey);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  const metadata = object.httpMetadata;

  if (metadata?.contentType) headers.set("content-type", metadata.contentType);
  if (metadata?.contentLanguage) headers.set("content-language", metadata.contentLanguage);
  if (metadata?.contentDisposition) headers.set("content-disposition", metadata.contentDisposition);
  if (metadata?.contentEncoding) headers.set("content-encoding", metadata.contentEncoding);
  headers.set("cache-control", metadata?.cacheControl || "public, max-age=604800");
  if (object.httpEtag) headers.set("etag", object.httpEtag);

  const body = await object.arrayBuffer();
  return new Response(body, { status: 200, headers });
}
