import type { Villa } from "@/lib/types";

export type InstagramPublishType = "IMAGE" | "CAROUSEL" | "REELS";

export type InstagramPublishInput = {
  villa: Villa;
  type: InstagramPublishType;
  mediaUrls: string[];
  caption: string;
  shareToFeed: boolean;
};

export function isVilla(value: unknown): value is Villa {
  return value === "Destan" || value === "Safira";
}

export function isInstagramPublishType(
  value: unknown,
): value is InstagramPublishType {
  return value === "IMAGE" || value === "CAROUSEL" || value === "REELS";
}

export function validateInstagramPublishInput(
  input: InstagramPublishInput,
  options: { captionRequired: boolean },
) {
  if (!isVilla(input.villa)) throw new Error("Geçerli villa seçin.");
  if (!isInstagramPublishType(input.type)) {
    throw new Error("Yayın türü geçersiz.");
  }
  if (!Array.isArray(input.mediaUrls)) {
    throw new Error("Medya adresleri geçersiz.");
  }

  if (input.type === "IMAGE" && input.mediaUrls.length !== 1) {
    throw new Error("Tek fotoğraf yayını için tam 1 JPEG gerekli.");
  }
  if (
    input.type === "CAROUSEL" &&
    (input.mediaUrls.length < 2 || input.mediaUrls.length > 10)
  ) {
    throw new Error("Carousel yayını 2-10 JPEG içermeli.");
  }
  if (input.type === "REELS" && input.mediaUrls.length !== 1) {
    throw new Error("Reels yayını için tam 1 MP4 gerekli.");
  }

  if (input.caption.length > 2200) {
    throw new Error("Paylaşım metni en fazla 2200 karakter olabilir.");
  }
  if (options.captionRequired && !input.caption.trim()) {
    throw new Error("Paylaşım metni boş olamaz.");
  }
}
