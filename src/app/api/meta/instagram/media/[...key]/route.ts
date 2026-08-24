import { INSTAGRAM_MEDIA_PREFIX } from "@/lib/instagramTokenStore";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type MediaMetadata = {
  contentType?: string;
  cacheControl?: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const objectKey = key.join("/");

  if (
    !objectKey.startsWith(INSTAGRAM_MEDIA_PREFIX) ||
    objectKey.includes("..")
  ) {
    return new Response("Not found", { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });

  if (!env.SOCIAL_MEDIA_KV) {
    return new Response("Media storage unavailable", { status: 503 });
  }

  const object = await env.SOCIAL_MEDIA_KV.getWithMetadata<MediaMetadata>(
    objectKey,
    "arrayBuffer",
  );
  if (!object.value) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  const metadata = object.metadata;

  if (metadata?.contentType) headers.set("content-type", metadata.contentType);
  headers.set(
    "cache-control",
    metadata?.cacheControl || "public, max-age=604800, immutable",
  );

  return new Response(object.value, { status: 200, headers });
}
