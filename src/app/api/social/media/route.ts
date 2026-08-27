import { acceptedInstagramMedia, type InstagramMediaMetadata } from "@/lib/instagramMedia";
import { INSTAGRAM_LIBRARY_PREFIX } from "@/lib/instagramTokenStore";
import {
  addMediaLibraryItem,
  deactivateMediaLibraryItem,
  listMediaLibrary,
  socialOperationsDb,
  updateMediaLibraryItem,
} from "@/lib/socialOperationsDb";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";
const imageCategories = ["Dış cephe", "Havuz", "Salon", "Mutfak", "Yatak odası", "Banyo", "Bahçe", "Manzara", "Gün batımı", "Patara", "Detay", "Diğer"];
const videoCategories = ["Villa turu", "Havuz", "Bahçe", "Gün batımı", "Reels", "Diğer"];
const isVilla = (value: unknown): value is Villa => value === "Destan" || value === "Safira";

export async function GET(request: Request) {
  try {
    const rawVilla = new URL(request.url).searchParams.get("villa");
    const villa = isVilla(rawVilla) ? rawVilla : undefined;
    const { db } = await socialOperationsDb();
    return Response.json({ items: await listMediaLibrary(db, villa), imageCategories, videoCategories });
  } catch {
    return Response.json({ error: "Medya kütüphanesi yüklenemedi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { db, env } = await socialOperationsDb();
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const villa = form.get("villa");
      const label = String(form.get("label") ?? "").trim();
      const category = String(form.get("category") ?? "Diğer").trim();
      if (!(file instanceof File) || !isVilla(villa)) throw new Error("Dosya ve villa seçimi gerekli.");
      const accepted = await acceptedInstagramMedia(file);
      if (!accepted) throw new Error("Yalnızca gerçek JPG/JPEG veya MP4 dosyası yükleyin.");
      if (file.size <= 0 || file.size > accepted.maxBytes) {
        throw new Error(accepted.contentType === "video/mp4" ? "Video en fazla 24 MiB olabilir." : "Fotoğraf en fazla 8 MiB olabilir.");
      }
      const allowed = accepted.contentType === "video/mp4" ? videoCategories : imageCategories;
      if (!allowed.includes(category)) throw new Error("Medya kategorisi geçersiz.");
      const id = crypto.randomUUID();
      const slug = villa.toLocaleLowerCase("tr-TR");
      const key = `${INSTAGRAM_LIBRARY_PREFIX}${slug}/${id}.${accepted.extension}`;
      await env.SOCIAL_MEDIA_KV.put(key, await file.arrayBuffer(), {
        metadata: { contentType: accepted.contentType, cacheControl: "public, max-age=86400, immutable",
          villa, originalName: file.name.slice(0, 180), size: file.size, purpose: "library" } satisfies InstagramMediaMetadata,
      });
      const encodedKey = key.split("/").map(encodeURIComponent).join("/");
      const publicUrl = `${env.APP_BASE_URL.replace(/\/$/, "")}/api/meta/instagram/media/${encodedKey}`;
      try {
        const item = await addMediaLibraryItem(db, { id, villa, mediaType: accepted.contentType === "video/mp4" ? "VIDEO" : "IMAGE",
          key, publicUrl, filename: file.name, label, category });
        return Response.json({ item }, { status: 201 });
      } catch (error) {
        await env.SOCIAL_MEDIA_KV.delete(key);
        throw error;
      }
    }
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.id !== "string") throw new Error("Medya kaydı gerekli.");
    if (body.action === "deactivate") {
      return Response.json({ ok: await deactivateMediaLibraryItem(db, body.id) });
    }
    if (body.action === "update") {
      const item = await updateMediaLibraryItem(db, body.id, {
        label: typeof body.label === "string" ? body.label : undefined,
        category: typeof body.category === "string" ? body.category : undefined,
        active: typeof body.active === "boolean" ? body.active : undefined,
        favorite: typeof body.favorite === "boolean" ? body.favorite : undefined,
      });
      return item ? Response.json({ item }) : Response.json({ error: "Medya bulunamadı." }, { status: 404 });
    }
    throw new Error("Medya işlemi geçersiz.");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Medya işlemi başarısız." }, { status: 400 });
  }
}
