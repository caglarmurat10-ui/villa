import type { D1Database } from "@cloudflare/workers-types";
import {
  aiCircuitOpen,
  assertAiBudget,
  getAiSettings,
  logAiUsage,
  recordAiServiceResult,
  saveMediaProvenance,
} from "./aiDb";
import { hasOpenAiConfiguration, requireOpenAiApiKey } from "./aiConfiguration";
import { acceptedInstagramMedia, IMAGE_MAX_BYTES, type InstagramMediaMetadata } from "./instagramMedia";
import { INSTAGRAM_LIBRARY_PREFIX } from "./instagramTokenStore";
import { addMediaLibraryItem, deactivateMediaLibraryItem } from "./socialOperationsDb";
import type { Villa } from "./types";

const IMAGE_GENERATION_URL = "https://api.openai.com/v1/images/generations";

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function safeIllustrationPrompt(villa: Villa, prompt: string) {
  const clean = prompt.trim().slice(0, 1000);
  if (!clean) throw new Error("Görsel açıklaması gerekli.");
  return `${clean}\n\nBu çalışma turistik bir illüstrasyondur. Villa ${villa}'nın gerçek dış veya iç görünüşünü, gerçek mimarisini ya da doğrulanmamış bir özelliğini taklit etme. Görsele villa fotoğrafıymış izlenimi veren ifade ekleme.`;
}

export async function generateAiIllustration(input: {
  db: D1Database;
  env: CloudflareEnv;
  villa: Villa;
  prompt: string;
  fetcher?: typeof fetch;
}) {
  const apiKey = requireOpenAiApiKey(input.env);
  const settings = await getAiSettings(input.db, input.villa);
  if (String(input.env.AI_IMAGE_ENABLED) !== "true" || !settings.imageEnabled) {
    throw new Error("AI görsel üretimi hem sistem hem villa ayarlarında kapalı.");
  }
  await assertAiBudget(input.db, input.villa, "image");
  if (await aiCircuitOpen(input.db, "openai-image")) throw new Error("AI görsel servisi geçici olarak dinlenmede.");
  const model = input.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  let success = false;
  try {
    const response = await (input.fetcher ?? fetch)(IMAGE_GENERATION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: safeIllustrationPrompt(input.villa, input.prompt), size: "1024x1024",
        quality: "medium", output_format: "jpeg", n: 1 }),
    });
    if (!response.ok) throw new Error("AI görsel servisi isteği tamamlayamadı.");
    const body = await response.json() as { data?: Array<{ b64_json?: string }> };
    const encoded = body.data?.[0]?.b64_json;
    if (!encoded) throw new Error("AI görsel servisi geçerli dosya döndürmedi.");
    const bytes = decodeBase64(encoded);
    if (!bytes.byteLength || bytes.byteLength > IMAGE_MAX_BYTES) throw new Error("AI görseli yayın boyutu sınırını aşıyor.");
    const file = new File([bytes], "openai-illustration.jpg", { type: "image/jpeg" });
    const accepted = await acceptedInstagramMedia(file);
    if (!accepted || accepted.contentType !== "image/jpeg") throw new Error("AI görsel biçimi doğrulanamadı.");

    const mediaId = crypto.randomUUID();
    const key = `${INSTAGRAM_LIBRARY_PREFIX}${input.villa.toLocaleLowerCase("tr-TR")}/${mediaId}.jpg`;
    await input.env.SOCIAL_MEDIA_KV.put(key, bytes, { metadata: { contentType: "image/jpeg",
      cacheControl: "public, max-age=86400, immutable", villa: input.villa,
      originalName: "openai-illustration.jpg", size: bytes.byteLength, purpose: "library" } satisfies InstagramMediaMetadata });
    const publicUrl = `${input.env.APP_BASE_URL.replace(/\/$/, "")}/api/meta/instagram/media/${key.split("/").map(encodeURIComponent).join("/")}`;
    try {
      const item = await addMediaLibraryItem(input.db, { id: mediaId, villa: input.villa, mediaType: "IMAGE", key,
        publicUrl, filename: "openai-illustration.jpg", label: "AI üretimi illüstrasyon", category: "Diğer" });
      if (!item) throw new Error("AI görseli medya kütüphanesine eklenemedi.");
      await saveMediaProvenance(input.db, { mediaId, source: "OpenAI", sourceId: model,
        licenseSource: "OpenAI generated", aiGenerated: true,
        geographicClaim: "İllüstrasyon; gerçek villa veya konum fotoğrafı değildir" });
      success = true;
      await recordAiServiceResult(input.db, "openai-image", true);
      return item;
    } catch (error) {
      await input.env.SOCIAL_MEDIA_KV.delete(key);
      await deactivateMediaLibraryItem(input.db, mediaId).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    await recordAiServiceResult(input.db, "openai-image", false);
    if (error instanceof Error && /kapalı|limit|dinlenmede|yapılandırılmadı|boyutu|biçimi/.test(error.message)) throw error;
    throw new Error("AI görsel servisine şu anda ulaşılamıyor. Kendi medya kütüphaneniz kullanılabilir.");
  } finally {
    await logAiUsage(input.db, { service: "openai-image", operation: "image", model,
      villa: input.villa, estimatedUnits: success ? 1 : 0, success }).catch(() => undefined);
  }
}

export async function videoGenerationStatus(db: D1Database, env: CloudflareEnv, villa: Villa) {
  const settings = await getAiSettings(db, villa);
  return {
    enabled: hasOpenAiConfiguration(env) && String(env.AI_VIDEO_ENABLED) === "true" && settings.videoEnabled,
    available: false,
    requiresSeparatePaidConfirmation: true,
    message: "Storyboard üretimi hazır. Ücretli video üretimi, sağlayıcı desteği yeniden doğrulanıp ayrıca onaylanmadan çağrılmaz.",
  };
}
