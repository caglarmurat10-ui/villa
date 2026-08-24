import { INSTAGRAM_MEDIA_PREFIX } from "@/lib/instagramTokenStore";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

function getExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  return "";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const villa = String(form.get("villa") ?? "");

    if (!(file instanceof File)) {
      return Response.json({ error: "Yayınlanacak fotoğraf seçilmedi." }, { status: 400 });
    }

    if (!["Destan", "Safira"].includes(villa)) {
      return Response.json({ error: "Geçerli villa seçin." }, { status: 400 });
    }

    const extension = getExtension(file);
    if (!extension) {
      return Response.json(
        { error: "İlk sürümde Instagram gönderileri için JPEG/JPG fotoğraf yükleyin." },
        { status: 400 },
      );
    }

    const maxBytes = 8 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      return Response.json({ error: "Fotoğraf boyutu 8 MB veya daha küçük olmalı." }, { status: 400 });
    }

    const { env } = await getCloudflareContext({ async: true });

    if (!env.SOCIAL_MEDIA_KV) {
      return Response.json(
        { error: "Cloudflare Workers KV medya bağlantısı yapılandırılmamış." },
        { status: 500 },
      );
    }

    const villaSlug = villa.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/g, "-");
    const key = `${INSTAGRAM_MEDIA_PREFIX}${villaSlug}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;

    await env.SOCIAL_MEDIA_KV.put(key, await file.arrayBuffer(), {
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=604800, immutable",
        villa,
        originalName: file.name.slice(0, 180),
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
      mimeType: file.type,
    });
  } catch {
    return Response.json(
      { error: "Fotoğraf yüklenirken beklenmeyen bir hata oluştu." },
      { status: 500 },
    );
  }
}
