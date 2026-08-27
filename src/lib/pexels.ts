import type { D1Database } from "@cloudflare/workers-types";
import { acceptedInstagramMedia, IMAGE_MAX_BYTES, REELS_MAX_BYTES, type InstagramMediaMetadata } from "./instagramMedia";
import { INSTAGRAM_LIBRARY_PREFIX } from "./instagramTokenStore";
import { saveMediaProvenance } from "./aiDb";
import { requirePexelsApiKey } from "./aiConfiguration";
import { addMediaLibraryItem, deactivateMediaLibraryItem } from "./socialOperationsDb";
import type { Villa } from "./types";

const PEXELS_API = "https://api.pexels.com";

type PexelsPhoto = {
  id?: number; url?: string; photographer?: string; photographer_url?: string; alt?: string;
  src?: Record<string, string | undefined>;
};
type PexelsVideoFile = { id?: number; link?: string; file_type?: string; width?: number; height?: number; file_size?: number };
type PexelsVideo = { id?: number; url?: string; user?: { name?: string; url?: string }; video_files?: PexelsVideoFile[]; image?: string };

export type PexelsResult = {
  id: string;
  kind: "photo" | "video";
  previewUrl: string;
  sourceUrl: string;
  photographer: string;
  photographerUrl: string;
  description: string;
  geographicClaim: string;
  licenseSource: "Pexels";
};

function httpsUrl(value: unknown, allowedHosts?: string[]) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || (allowedHosts && !allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)))) return null;
    return url.toString();
  } catch { return null; }
}

export function pexelsGeographicClaim(description: string) {
  const normalized = description.toLocaleLowerCase("tr-TR");
  if (/\bpatara\b/.test(normalized)) return "Patara";
  if (/(^|\s)kaş($|\s|[,.])/i.test(normalized)) return "Kaş";
  return "Akdeniz teması; Patara veya Kaş olarak doğrulanmadı";
}

export function parsePexelsPhotos(items: PexelsPhoto[]): PexelsResult[] {
  return items.flatMap((photo) => {
    const id = Number(photo.id);
    const previewUrl = httpsUrl(photo.src?.large ?? photo.src?.large2x ?? photo.src?.medium, ["pexels.com"]);
    const sourceUrl = httpsUrl(photo.url, ["pexels.com"]);
    if (!Number.isSafeInteger(id) || id <= 0 || !previewUrl || !sourceUrl) return [];
    const description = String(photo.alt ?? "").slice(0, 300);
    return [{ id: String(id), kind: "photo" as const, previewUrl, sourceUrl,
      photographer: String(photo.photographer ?? "Pexels içerik üreticisi").slice(0, 120),
      photographerUrl: httpsUrl(photo.photographer_url, ["pexels.com"]) ?? sourceUrl,
      description, geographicClaim: pexelsGeographicClaim(description), licenseSource: "Pexels" as const }];
  });
}

export function parsePexelsVideos(items: PexelsVideo[]): PexelsResult[] {
  return items.flatMap((video) => {
    const id = Number(video.id);
    const previewUrl = httpsUrl(video.image, ["pexels.com"]);
    const sourceUrl = httpsUrl(video.url, ["pexels.com"]);
    if (!Number.isSafeInteger(id) || id <= 0 || !previewUrl || !sourceUrl) return [];
    const description = "Pexels stok videosu";
    return [{ id: String(id), kind: "video" as const, previewUrl, sourceUrl,
      photographer: String(video.user?.name ?? "Pexels içerik üreticisi").slice(0, 120),
      photographerUrl: httpsUrl(video.user?.url, ["pexels.com"]) ?? sourceUrl,
      description, geographicClaim: pexelsGeographicClaim(description), licenseSource: "Pexels" as const }];
  });
}

async function pexelsJson<T>(env: CloudflareEnv, path: string, fetcher: typeof fetch = fetch) {
  const response = await fetcher(`${PEXELS_API}${path}`, { headers: { Authorization: requirePexelsApiKey(env) } });
  if (!response.ok) throw new Error("Pexels servisine şu anda ulaşılamıyor.");
  return response.json() as Promise<T>;
}

export async function searchPexels(env: CloudflareEnv, input: { query: string; kind: "photo" | "video" }, fetcher: typeof fetch = fetch) {
  const query = input.query.trim().slice(0, 100);
  if (!query) throw new Error("Arama konusu gerekli.");
  const encoded = encodeURIComponent(query);
  if (input.kind === "photo") {
    const data = await pexelsJson<{ photos?: PexelsPhoto[] }>(env, `/v1/search?query=${encoded}&per_page=12&orientation=landscape`, fetcher);
    return parsePexelsPhotos(data.photos ?? []);
  }
  const data = await pexelsJson<{ videos?: PexelsVideo[] }>(env, `/videos/search?query=${encoded}&per_page=12&orientation=landscape`, fetcher);
  return parsePexelsVideos(data.videos ?? []);
}

function selectVideoFile(video: PexelsVideo) {
  return (video.video_files ?? []).filter((item) => item.file_type === "video/mp4" &&
    typeof item.file_size === "number" && item.file_size > 0 && item.file_size <= REELS_MAX_BYTES &&
    Boolean(httpsUrl(item.link, ["pexels.com"])))
    .sort((left, right) => (right.width ?? 0) - (left.width ?? 0))[0] ?? null;
}

export async function importPexelsMedia(input: {
  db: D1Database;
  env: CloudflareEnv;
  villa: Villa;
  id: string;
  kind: "photo" | "video";
  query: string;
  fetcher?: typeof fetch;
}) {
  if (!/^\d{1,18}$/.test(input.id)) throw new Error("Pexels medya kimliği geçersiz.");
  const fetcher = input.fetcher ?? fetch;
  let item: PexelsResult;
  let downloadUrl: string;
  if (input.kind === "photo") {
    const photo = await pexelsJson<PexelsPhoto>(input.env, `/v1/photos/${input.id}`, fetcher);
    item = parsePexelsPhotos([photo])[0];
    downloadUrl = httpsUrl(photo.src?.large2x ?? photo.src?.large, ["pexels.com"]) ?? "";
  } else {
    const video = await pexelsJson<PexelsVideo>(input.env, `/videos/videos/${input.id}`, fetcher);
    item = parsePexelsVideos([video])[0];
    downloadUrl = httpsUrl(selectVideoFile(video)?.link, ["pexels.com"]) ?? "";
  }
  if (!item || !downloadUrl || item.id !== input.id) throw new Error("Pexels medya kaydı doğrulanamadı.");
  const downloaded = await fetcher(downloadUrl);
  if (!downloaded.ok) throw new Error("Pexels medya dosyası indirilemedi.");
  const declaredLength = Number(downloaded.headers.get("content-length") ?? 0);
  const maxBytes = input.kind === "photo" ? IMAGE_MAX_BYTES : REELS_MAX_BYTES;
  if (declaredLength > maxBytes) throw new Error("Pexels medya dosyası yayın boyutu sınırını aşıyor.");
  const bytes = await downloaded.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > maxBytes) throw new Error("Pexels medya dosyası yayın boyutu sınırını aşıyor.");
  const expectedType = input.kind === "photo" ? "image/jpeg" : "video/mp4";
  const file = new File([bytes], `pexels-${input.id}.${input.kind === "photo" ? "jpg" : "mp4"}`, { type: expectedType });
  const accepted = await acceptedInstagramMedia(file);
  if (!accepted || accepted.contentType !== expectedType) throw new Error("Pexels medya dosyasının biçimi doğrulanamadı.");

  const mediaId = crypto.randomUUID();
  const key = `${INSTAGRAM_LIBRARY_PREFIX}${input.villa.toLocaleLowerCase("tr-TR")}/${mediaId}.${accepted.extension}`;
  await input.env.SOCIAL_MEDIA_KV.put(key, bytes, { metadata: { contentType: accepted.contentType,
    cacheControl: "public, max-age=86400, immutable", villa: input.villa, originalName: file.name,
    size: bytes.byteLength, purpose: "library" } satisfies InstagramMediaMetadata });
  const publicUrl = `${input.env.APP_BASE_URL.replace(/\/$/, "")}/api/meta/instagram/media/${key.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const libraryItem = await addMediaLibraryItem(input.db, { id: mediaId, villa: input.villa,
      mediaType: input.kind === "photo" ? "IMAGE" : "VIDEO", key, publicUrl, filename: file.name,
      label: `${item.photographer} · Pexels`, category: input.kind === "photo" ? "Diğer" : "Reels" });
    if (!libraryItem) throw new Error("Medya kütüphanesine eklenemedi.");
    await saveMediaProvenance(input.db, { mediaId, source: "Pexels", photographer: item.photographer,
      photographerUrl: item.photographerUrl, sourceUrl: item.sourceUrl, sourceId: item.id,
      searchQuery: input.query.trim().slice(0, 100), licenseSource: "Pexels",
      geographicClaim: item.geographicClaim });
    return { item: libraryItem, provenance: item };
  } catch (error) {
    await input.env.SOCIAL_MEDIA_KV.delete(key);
    await deactivateMediaLibraryItem(input.db, mediaId).catch(() => undefined);
    throw error;
  }
}
