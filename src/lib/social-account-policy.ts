import type { SocialPlatform, Villa } from "./types";

export type MetaPlatform = "Instagram" | "Facebook";

export type MetaTarget = {
  villa: Villa;
  platform: MetaPlatform;
};

export const DESTAN_INSTAGRAM_HARD_BLOCK = {
  villa: "Destan" as const,
  platform: "Instagram" as const,
  blocked: false as boolean,
  reason: "Instagram OAuth bağlantısı başarıyla doğrulandı; Destan Instagram aktif Meta hedefidir.",
};

// Organik yayın için fiilen desteklenen Meta hedefleri. Destan Instagram OAuth bağlantısı
// 2026-09-05 tarihinde başarıyla doğrulandığı için aktif hedefler arasına alınmıştır.
export const META_ACTIVE_TARGETS = [
  { villa: "Safira", platform: "Instagram" },
  { villa: "Safira", platform: "Facebook" },
  { villa: "Destan", platform: "Facebook" },
  { villa: "Destan", platform: "Instagram" },
] as const satisfies readonly MetaTarget[];

// Sağlık ekranı SocialPost.platform (Instagram/Facebook/TikTok/WhatsApp Durum) ile çalışır.
// Bu helper yalnız politika bayrağı tekrar açılırsa Destan+Instagram kombinasyonunu bloklar;
// OAuth doğrulaması sonrası mevcut production politikası blocked=false olduğu için dört Meta hedefi aktiftir.
export function isMetaTargetHardBlocked(villa: Villa, platform: SocialPlatform) {
  return DESTAN_INSTAGRAM_HARD_BLOCK.blocked && villa === DESTAN_INSTAGRAM_HARD_BLOCK.villa && platform === DESTAN_INSTAGRAM_HARD_BLOCK.platform;
}

export function metaTargetLabel(target: MetaTarget) {
  return `${target.villa} ${target.platform}`;
}
