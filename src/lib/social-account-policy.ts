import type { Villa } from "./types";

export type MetaPlatform = "Instagram" | "Facebook";

export type MetaTarget = {
  villa: Villa;
  platform: MetaPlatform;
};

export const DESTAN_INSTAGRAM_HARD_BLOCK = {
  villa: "Destan" as const,
  platform: "Instagram" as const,
  blocked: true as const,
  reason: "Meta Business Portfolio / hesap sahipliği sorunu çözülene kadar bağlantı ve yayın devre dışı.",
};

// Organik yayın için fiilen desteklenen hedefler. Destan Instagram bilinçli olarak bu listede yoktur;
// hem cron hem manuel publish endpoint'i ayrıca HARD BLOCK uygular.
export const META_ACTIVE_TARGETS = [
  { villa: "Safira", platform: "Instagram" },
  { villa: "Safira", platform: "Facebook" },
  { villa: "Destan", platform: "Facebook" },
] as const satisfies readonly MetaTarget[];

export function isMetaTargetHardBlocked(villa: Villa, platform: MetaPlatform) {
  return villa === DESTAN_INSTAGRAM_HARD_BLOCK.villa && platform === DESTAN_INSTAGRAM_HARD_BLOCK.platform;
}

export function metaTargetLabel(target: MetaTarget) {
  return `${target.villa} ${target.platform}`;
}
