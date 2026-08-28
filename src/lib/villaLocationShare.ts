import type { VillaProfile } from "./villaProfiles";

const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type ShareNavigator = {
  canShare?: (data?: ShareData) => boolean;
  share?: (data?: ShareData) => Promise<void>;
};

type ShareDependencies = {
  navigator: ShareNavigator;
  downloadImage: (url: string, fileName: string) => void;
  openWhatsApp: (url: string) => void;
};

export type VillaLocationShareResult = "shared" | "fallback" | "cancelled";

function imageExtension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export async function fetchVillaImageFile(profile: VillaProfile, signal?: AbortSignal) {
  const response = await fetch(profile.publicImageUrl, { signal, cache: "force-cache" });
  if (!response.ok) throw new Error("Villa fotoğrafı yüklenemedi.");

  const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (!supportedImageTypes.has(contentType)) throw new Error("Villa fotoğrafı biçimi desteklenmiyor.");

  const blob = await response.blob();
  if (blob.size === 0) throw new Error("Villa fotoğrafı boş.");
  return new File([blob], `${profile.imageFileBase}.${imageExtension(contentType)}`, { type: contentType });
}

export function canShareVillaImage(navigator: ShareNavigator, file: File | undefined) {
  if (!file || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareVillaLocation(
  input: { file?: File; text: string; title: string; whatsappUrl: string; publicImageUrl: string; imageFileBase: string },
  dependencies: ShareDependencies,
): Promise<VillaLocationShareResult> {
  if (canShareVillaImage(dependencies.navigator, input.file)) {
    try {
      await dependencies.navigator.share!({ files: [input.file!], text: input.text, title: input.title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }

  dependencies.downloadImage(input.publicImageUrl, input.imageFileBase);
  dependencies.openWhatsApp(input.whatsappUrl);
  return "fallback";
}
