import { INSTAGRAM_MEDIA_PREFIX } from "@/lib/instagramTokenStore";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const REELS_MAX_BYTES = 24 * 1024 * 1024;
const MEDIA_EXPIRATION_SECONDS = 24 * 60 * 60;

type AcceptedMedia = {
  contentType: "image/jpeg" | "video/mp4";
  extension: "jpg" | "mp4";
  maxBytes: number;
};

async function acceptedMedia(file: File): Promise<AcceptedMedia | null> {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  if (
    file.type === "image/jpeg" &&
    header.length >= 3 &&
    header[0] === 0xff &&
    header[1] === 0xd8 &&
    header[2] === 0xff
  ) {
    return {
      contentType: "image/jpeg",
      extension: "jpg",
      maxBytes: IMAGE_MAX_BYTES,
    };
  }

  const hasFtypBox =
    header.length >= 12 &&
    header[4] === 0x66 &&
    header[5] === 0x74 &&
    header[6] === 0x79 &&
    header[7] === 0x70;

  if (file.type === "video/mp4" && hasFtypBox) {
    return {
      contentType: "video/mp4",
      extension: "mp4",
      maxBytes: REELS_MAX_BYTES,
    };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const villa = String(form.get("villa") ?? "");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Yayınlanacak medya dosyası seçilmedi." },
        { status: 400 },
      );
    }

    if (!["Destan", "Safira"].includes(villa)) {
      return Response.json({ error: "Geçerli villa seçin." }, { status: 400 });
    }

    const media = await acceptedMedia(file);
    if (!media) {
      return Response.json(
        { error: "Yalnızca gerçek JPG/JPEG fotoğraf veya MP4 video yükleyin." },
        { status: 400 },
      );
    }

    if (file.size <= 0 || file.size > media.maxBytes) {
      const limit = media.contentType === "video/mp4" ? "24 MiB" : "8 MiB";
      return Response.json(
        { error: `Dosya boyutu ${limit} veya daha küçük olmalı.` },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });

    const villaSlug = villa.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/g, "-");
    const key = `${INSTAGRAM_MEDIA_PREFIX}${villaSlug}/${new Date()
      .toISOString()
      .slice(0, 10)}/${crypto.randomUUID()}.${media.extension}`;

    await env.SOCIAL_MEDIA_KV.put(key, await file.arrayBuffer(), {
      expirationTtl: MEDIA_EXPIRATION_SECONDS,
      metadata: {
        contentType: media.contentType,
        cacheControl: "public, max-age=86400, immutable",
        villa,
        originalName: file.name.slice(0, 180),
        size: file.size,
      },
    });

    const baseUrl = (env.APP_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const publicUrl = `${baseUrl}/api/meta/instagram/media/${encodedKey}`;

    return Response.json({
      ok: true,
      key,
      publicUrl,
      size: file.size,
      mimeType: media.contentType,
      expiresIn: MEDIA_EXPIRATION_SECONDS,
    });
  } catch {
    return Response.json(
      { error: "Medya yüklenirken beklenmeyen bir hata oluştu." },
      { status: 500 },
    );
  }
}
