import type { Villa } from "./types";

export type RecentContent = {
  villa: Villa;
  captionHash?: string | null;
  mediaIds: string[];
  templateId?: string | null;
  availabilityStart?: string | null;
  availabilityEnd?: string | null;
  publishedOrScheduledAt: string;
};

export type MediaCandidate = {
  id: string;
  category: string;
  favorite: boolean;
  useCount: number;
  lastUsedAt: string | null;
  active: boolean;
};

export function hashCaption(caption: string) {
  let hash = 5381;
  const normalized = caption.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (Math.imul(hash, 33) ^ normalized.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function detectDuplicateContent(
  candidate: Omit<RecentContent, "publishedOrScheduledAt">,
  recent: RecentContent[],
) {
  return recent.find((item) => {
    const sameWindow =
      Boolean(candidate.availabilityStart) &&
      candidate.availabilityStart === item.availabilityStart &&
      candidate.availabilityEnd === item.availabilityEnd;
    const sameCaption =
      Boolean(candidate.captionHash) && candidate.captionHash === item.captionHash;
    const sameMedia =
      candidate.mediaIds.length > 0 &&
      candidate.mediaIds.length === item.mediaIds.length &&
      candidate.mediaIds.every((id, index) => id === item.mediaIds[index]);
    const sameTemplate =
      Boolean(candidate.templateId) && candidate.templateId === item.templateId;
    return item.villa === candidate.villa && (sameWindow || (sameCaption && sameMedia && sameTemplate));
  }) ?? null;
}

const categoryOrder = [
  "Havuz",
  "Dış cephe",
  "Salon",
  "Bahçe",
  "Gün batımı",
  "Mutfak",
  "Yatak odası",
  "Manzara",
  "Patara",
  "Detay",
  "Diğer",
];

export function selectRotatingMedia(
  candidates: MediaCandidate[],
  recentMediaIds: string[],
  recentCategories: string[],
) {
  const active = candidates.filter((item) => item.active);
  if (!active.length) return null;
  const lastThree = new Set(recentMediaIds.slice(0, 3));
  const eligible = active.some((item) => !lastThree.has(item.id))
    ? active.filter((item) => !lastThree.has(item.id))
    : active;
  const previousCategory = recentCategories[0];
  const previousIndex = Math.max(0, categoryOrder.indexOf(previousCategory));
  const categoryRank = (category: string) => {
    const index = categoryOrder.indexOf(category);
    if (index < 0) return categoryOrder.length;
    return (index - previousIndex - 1 + categoryOrder.length) % categoryOrder.length;
  };
  return [...eligible].sort((left, right) =>
    Number(right.favorite) - Number(left.favorite) ||
    left.useCount - right.useCount ||
    categoryRank(left.category) - categoryRank(right.category) ||
    (left.lastUsedAt ?? "").localeCompare(right.lastUsedAt ?? "") ||
    left.id.localeCompare(right.id),
  )[0];
}

export function pilotLimitDecision(
  scheduledTimes: string[],
  candidateTime: string,
  weeklyTarget = 3,
) {
  const candidate = new Date(candidateTime);
  const day = candidateTime.slice(0, 10);
  const weekStart = new Date(candidate);
  const isoDay = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - isoDay);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const parsed = scheduledTimes.map((value) => new Date(value));
  if (scheduledTimes.some((value) => value.slice(0, 10) === day)) {
    return { allowed: false, reason: "daily-limit" } as const;
  }
  if (parsed.filter((value) => value >= weekStart && value < weekEnd).length >= weeklyTarget) {
    return { allowed: false, reason: "weekly-limit" } as const;
  }
  if (parsed.some((value) => Math.abs(candidate.getTime() - value.getTime()) < 20 * 60 * 60 * 1000)) {
    return { allowed: false, reason: "minimum-spacing" } as const;
  }
  return { allowed: true, reason: null } as const;
}

export function contentScore(input: {
  caption: string;
  hasCta: boolean;
  hasMedia: boolean;
  dateValid: boolean;
  mediaRecentlyUsed: boolean;
  duplicate: boolean;
  availabilityValid: boolean;
}) {
  let score = 100;
  const reasons: string[] = [];
  function deduct(points: number, reason: string) {
    score -= points;
    reasons.push(reason);
  }
  if (!input.caption.trim()) deduct(25, "Paylaşım metni eksik.");
  if (input.caption.length > 2200) deduct(25, "Paylaşım metni 2200 karakteri aşıyor.");
  if (!input.hasCta) deduct(10, "İletişim çağrısı eksik.");
  if (!input.hasMedia) deduct(25, "Medya seçilmedi.");
  if (!input.dateValid) deduct(20, "Yayın tarihi geçerli değil.");
  if (input.mediaRecentlyUsed) deduct(10, "Bu medya yakın zamanda kullanıldı.");
  if (input.duplicate) deduct(35, "Son 30 günde aynı içerik bulunuyor.");
  if (!input.availabilityValid) deduct(40, "Müsaitlik artık geçerli değil.");
  return { score: Math.max(0, score), reasons };
}
