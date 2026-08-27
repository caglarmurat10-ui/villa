import {
  INSTAGRAM_LIBRARY_PREFIX,
  INSTAGRAM_MEDIA_PREFIX,
} from "@/lib/instagramTokenStore";
import type {
  InstagramPublishInput,
  InstagramPublishType,
} from "@/lib/instagramTypes";
import {
  minimumScheduledMediaExpiration,
  scheduledMediaExpirationTtl,
} from "@/lib/instagramTime";

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const REELS_MAX_BYTES = 24 * 1024 * 1024;

export type AcceptedMedia = {
  contentType: "image/jpeg" | "video/mp4";
  extension: "jpg" | "mp4";
  maxBytes: number;
};

export async function acceptedInstagramMedia(file: File): Promise<AcceptedMedia | null> {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === "image/jpeg" && header.length >= 3 &&
    header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg", maxBytes: IMAGE_MAX_BYTES };
  }
  const hasFtypBox = header.length >= 12 && header[4] === 0x66 && header[5] === 0x74 &&
    header[6] === 0x79 && header[7] === 0x70;
  if (file.type === "video/mp4" && hasFtypBox) {
    return { contentType: "video/mp4", extension: "mp4", maxBytes: REELS_MAX_BYTES };
  }
  return null;
}

export type InstagramMediaMetadata = {
  contentType?: string;
  cacheControl?: string;
  villa?: string;
  originalName?: string;
  size?: number;
  expiresAt?: string;
  scheduledAt?: string;
  purpose?: "manual" | "scheduled" | "library";
};

function expectedMedia(type: InstagramPublishType) {
  return type === "REELS"
    ? { contentType: "video/mp4", maxBytes: REELS_MAX_BYTES }
    : { contentType: "image/jpeg", maxBytes: IMAGE_MAX_BYTES };
}

function validHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      !url.search &&
      value.length <= 2048
    );
  } catch {
    return false;
  }
}

export function managedInstagramMediaKey(
  mediaUrl: string,
  appBaseUrl: string,
) {
  if (!validHttpsUrl(mediaUrl)) return null;

  const url = new URL(mediaUrl);
  const appUrl = new URL(appBaseUrl);
  const routePrefix = "/api/meta/instagram/media/";
  if (url.origin !== appUrl.origin || !url.pathname.startsWith(routePrefix)) {
    return null;
  }

  try {
    const key = url.pathname
      .slice(routePrefix.length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
    if (
      (!key.startsWith(INSTAGRAM_MEDIA_PREFIX) &&
        !key.startsWith(INSTAGRAM_LIBRARY_PREFIX)) ||
      key.includes("..") ||
      key.includes("\\") ||
      key.includes("\0")
    ) {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}

export async function validateManagedInstagramMedia(
  env: CloudflareEnv,
  input: InstagramPublishInput,
  options: { scheduledAt?: Date } = {},
) {
  const expected = expectedMedia(input.type);
  const requiredExpiration = options.scheduledAt
    ? minimumScheduledMediaExpiration(options.scheduledAt).getTime()
    : null;

  for (const mediaUrl of input.mediaUrls) {
    const key = managedInstagramMediaKey(mediaUrl, env.APP_BASE_URL);
    if (!key) {
      throw new Error("Medya önce güvenli yayın yükleme alanına yüklenmeli.");
    }

    const object =
      await env.SOCIAL_MEDIA_KV.getWithMetadata<InstagramMediaMetadata>(
        key,
        "stream",
      );
    if (!object.value) {
      throw new Error("Yüklenen medya bulunamadı veya süresi doldu.");
    }
    await object.value.cancel();

    if (object.metadata?.contentType !== expected.contentType) {
      throw new Error(
        input.type === "REELS"
          ? "Reels yayını için MP4 video gerekli."
          : "Fotoğraf yayınları için JPEG/JPG gerekli.",
      );
    }
    const size = object.metadata?.size;
    if (typeof size !== "number" || size <= 0 || size > expected.maxBytes) {
      throw new Error(
        input.type === "REELS"
          ? "Reels dosyası 24 MiB veya daha küçük olmalı."
          : "JPEG dosyası 8 MiB veya daha küçük olmalı.",
      );
    }

    if (requiredExpiration !== null && object.metadata?.purpose !== "library") {
      const expiresAt = Date.parse(object.metadata?.expiresAt ?? "");
      if (!Number.isFinite(expiresAt) || expiresAt < requiredExpiration) {
        throw new Error(
          "Planlanan yayın medyası seçilen zamana kadar saklanamıyor. Dosyayı yeniden yükleyin.",
        );
      }
    }
  }
}

export async function extendScheduledInstagramMediaLifetime(
  env: CloudflareEnv,
  mediaUrls: string[],
  scheduledAt: Date,
  now = new Date(),
) {
  const requiredExpiration = minimumScheduledMediaExpiration(scheduledAt);
  const expirationTtl = scheduledMediaExpirationTtl(scheduledAt, now);

  for (const mediaUrl of mediaUrls) {
    const key = managedInstagramMediaKey(mediaUrl, env.APP_BASE_URL);
    if (!key) throw new Error("Planlı yayın medya adresi geçersiz.");

    const object =
      await env.SOCIAL_MEDIA_KV.getWithMetadata<InstagramMediaMetadata>(
        key,
        "stream",
      );
    if (!object.value) {
      throw new Error("Planlı yayın medyası bulunamadı veya süresi doldu.");
    }

    const currentExpiration = Date.parse(object.metadata?.expiresAt ?? "");
    if (
      Number.isFinite(currentExpiration) &&
      currentExpiration >= requiredExpiration.getTime()
    ) {
      await object.value.cancel();
      continue;
    }

    await env.SOCIAL_MEDIA_KV.put(key, object.value, {
      expirationTtl,
      metadata: {
        ...object.metadata,
        cacheControl: "public, max-age=86400, immutable",
        expiresAt: new Date(now.getTime() + expirationTtl * 1000).toISOString(),
        scheduledAt: scheduledAt.toISOString(),
        purpose: "scheduled",
      } satisfies InstagramMediaMetadata,
    });
  }
}
