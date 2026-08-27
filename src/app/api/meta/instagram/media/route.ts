import { INSTAGRAM_MEDIA_PREFIX } from "@/lib/instagramTokenStore";
import {
  acceptedInstagramMedia,
  type InstagramMediaMetadata,
} from "@/lib/instagramMedia";
import {
  INSTAGRAM_TIMEZONE,
  scheduledMediaExpirationTtl,
  validateScheduledDate,
} from "@/lib/instagramTime";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

const MEDIA_EXPIRATION_SECONDS = 24 * 60 * 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const villa = String(form.get("villa") ?? "");
    const scheduledAtInput = String(form.get("scheduledAt") ?? "").trim();
    const timezone = String(form.get("timezone") ?? "").trim();

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Yayınlanacak medya dosyası seçilmedi." },
        { status: 400 },
      );
    }

    if (!["Destan", "Safira"].includes(villa)) {
      return Response.json({ error: "Geçerli villa seçin." }, { status: 400 });
    }

    const media = await acceptedInstagramMedia(file);
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
    const now = new Date();
    let scheduledAt: Date | null = null;
    if (scheduledAtInput) {
      try {
        scheduledAt = validateScheduledDate(scheduledAtInput, timezone, now);
      } catch (error) {
        return Response.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Planlama tarihi veya saati geçersiz.",
          },
          { status: 400 },
        );
      }
    }
    if (!scheduledAt && timezone && timezone !== INSTAGRAM_TIMEZONE) {
      return Response.json(
        { error: "Planlama saat dilimi Europe/Istanbul olmalı." },
        { status: 400 },
      );
    }
    const expirationTtl = scheduledAt
      ? scheduledMediaExpirationTtl(scheduledAt, now)
      : MEDIA_EXPIRATION_SECONDS;

    const villaSlug = villa.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/g, "-");
    const key = `${INSTAGRAM_MEDIA_PREFIX}${villaSlug}/${new Date()
      .toISOString()
      .slice(0, 10)}/${crypto.randomUUID()}.${media.extension}`;

    await env.SOCIAL_MEDIA_KV.put(key, await file.arrayBuffer(), {
      expirationTtl,
      metadata: {
        contentType: media.contentType,
        cacheControl: "public, max-age=86400, immutable",
        villa,
        originalName: file.name.slice(0, 180),
        size: file.size,
        expiresAt: new Date(
          now.getTime() + expirationTtl * 1000,
        ).toISOString(),
        scheduledAt: scheduledAt?.toISOString(),
        purpose: scheduledAt ? "scheduled" : "manual",
      } satisfies InstagramMediaMetadata,
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
      expiresIn: expirationTtl,
    });
  } catch {
    return Response.json(
      { error: "Medya yüklenirken beklenmeyen bir hata oluştu." },
      { status: 500 },
    );
  }
}
