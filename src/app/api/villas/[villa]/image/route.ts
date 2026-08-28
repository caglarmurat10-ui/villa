import { villaProfileFromSlug } from "@/lib/villaProfiles";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ villa: string }> };

const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function serveVillaImage(context: RouteContext, headOnly: boolean) {
  const { villa } = await context.params;
  const profile = villaProfileFromSlug(villa);
  if (!profile) return new Response("Not found", { status: 404 });

  try {
    const upstream = await fetch(profile.sourceImageUrl, {
      method: headOnly ? "HEAD" : "GET",
      headers: { Accept: "image/jpeg,image/png,image/webp" },
    });
    if (!upstream.ok || (!headOnly && !upstream.body)) {
      return new Response("Villa fotoğrafı kullanılamıyor.", { status: 502 });
    }

    const contentType = (upstream.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
    if (!allowedContentTypes.has(contentType)) {
      return new Response("Villa fotoğrafı kullanılamıyor.", { status: 502 });
    }

    const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const headers = new Headers({
      "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      "content-disposition": `inline; filename="${profile.imageFileBase}.${extension}"`,
      "content-type": contentType,
      "x-content-type-options": "nosniff",
    });
    const contentLength = upstream.headers.get("content-length");
    if (contentLength && /^\d+$/.test(contentLength)) headers.set("content-length", contentLength);

    return new Response(headOnly ? null : upstream.body, { status: 200, headers });
  } catch {
    return new Response("Villa fotoğrafı kullanılamıyor.", { status: 502 });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  return serveVillaImage(context, false);
}

export async function HEAD(_request: Request, context: RouteContext) {
  return serveVillaImage(context, true);
}
