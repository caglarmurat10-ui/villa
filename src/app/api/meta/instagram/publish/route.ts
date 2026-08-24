import { validateManagedInstagramMedia } from "@/lib/instagramMedia";
import {
  instagramTypeLabel,
  publishInstagramPost,
  safeInstagramError,
} from "@/lib/instagramPublish";
import {
  listInstagramPublishLogs,
  writeInstagramPublishLog,
} from "@/lib/instagramPublishLog";
import {
  isInstagramPublishType,
  isVilla,
  validateInstagramPublishInput,
  type InstagramPublishInput,
} from "@/lib/instagramTypes";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

export const dynamic = "force-dynamic";

type PublishRequest = InstagramPublishInput & {
  legacyImageRequest: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      value.length <= 2048
    );
  } catch {
    return false;
  }
}

function parsePublishRequest(value: unknown): PublishRequest {
  if (!isRecord(value)) throw new Error("Yayın isteği geçersiz.");

  const requestedVilla =
    typeof value.villa === "string" ? value.villa.trim() : "";
  if (!isVilla(requestedVilla)) throw new Error("Geçerli villa seçin.");

  const caption = typeof value.caption === "string" ? value.caption.trim() : "";
  if (!caption || caption.length > 2200) {
    throw new Error("Paylaşım metni 1-2200 karakter arasında olmalı.");
  }

  let type: InstagramPublishInput["type"];
  let mediaUrls: string[];
  let legacyImageRequest = false;

  if (isInstagramPublishType(value.type)) {
    type = value.type;
    if (
      !Array.isArray(value.mediaUrls) ||
      !value.mediaUrls.every((item): item is string => typeof item === "string")
    ) {
      throw new Error("Medya adresleri geçersiz.");
    }
    mediaUrls = value.mediaUrls.map((item) => item.trim());
  } else if (typeof value.imageUrl === "string") {
    type = "IMAGE";
    mediaUrls = [value.imageUrl.trim()];
    legacyImageRequest = true;
  } else {
    throw new Error("Yayın türü veya medya adresi eksik.");
  }

  if (!mediaUrls.every(validHttpsUrl)) {
    throw new Error("Instagram için geçerli HTTPS medya adresleri gerekli.");
  }

  if (value.shareToFeed !== undefined && typeof value.shareToFeed !== "boolean") {
    throw new Error("Akışta göster seçimi geçersiz.");
  }

  const input: PublishRequest = {
    villa: requestedVilla,
    type,
    mediaUrls,
    caption,
    shareToFeed: value.shareToFeed !== false,
    legacyImageRequest,
  };
  validateInstagramPublishInput(input, { captionRequired: true });
  return input;
}

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  return Response.json({ items: await listInstagramPublishLogs(env.DB) });
}

export async function POST(request: Request) {
  let db: D1Database | undefined;
  let publishRequest: PublishRequest | undefined;
  let username: string | null = null;

  try {
    const body: unknown = await request.json();
    publishRequest = parsePublishRequest(body);

    const { env } = await getCloudflareContext({ async: true });
    db = env.DB;

    // Eski imageUrl istemcileri geçici olarak çalışmaya devam eder.
    // Yeni yayın merkezi yalnızca metadata ile doğrulanan KV medya URL'lerini kullanır.
    if (!publishRequest.legacyImageRequest) {
      await validateManagedInstagramMedia(env, publishRequest);
    }

    const result = await publishInstagramPost(env, publishRequest);
    username = result.username;
    await writeInstagramPublishLog(db, {
      villa: publishRequest.villa,
      username,
      mediaUrls: publishRequest.mediaUrls,
      publishType: publishRequest.type,
      source: "manual",
      caption: publishRequest.caption,
      mediaId: result.instagramMediaId,
      status: "Yayınlandı",
    });

    return Response.json({
      ok: true,
      type: publishRequest.type,
      itemCount: publishRequest.mediaUrls.length,
      instagramMediaId: result.instagramMediaId,
      username,
      message: `Instagram ${instagramTypeLabel(publishRequest.type)} gönderisi başarıyla yayınlandı.`,
    });
  } catch (error) {
    const message = safeInstagramError(error);

    if (db && publishRequest) {
      try {
        await writeInstagramPublishLog(db, {
          villa: publishRequest.villa,
          username,
          mediaUrls: publishRequest.mediaUrls,
          publishType: publishRequest.type,
          source: "manual",
          caption: publishRequest.caption,
          status: "Hata",
          error: message,
        });
      } catch {
        // Ana hatayı gölgelememek için log hatası sessiz bırakılır.
      }
    }

    console.error(
      JSON.stringify({
        message: "instagram publish failed",
        villa: publishRequest?.villa ?? null,
        publishType: publishRequest?.type ?? null,
        error: message,
      }),
    );

    return Response.json({ error: message }, { status: 400 });
  }
}
