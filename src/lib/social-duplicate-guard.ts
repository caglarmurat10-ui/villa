// Faz 4 bolum K.5 / O - "Son 60 günlük gönderileri kontrol et. Aynı hook/caption/theme/media
// tekrarını engelle." SAF fonksiyon: hicbir D1/network cagrisi yok, yalniz verilen aday + son
// gonderi listesini karsilastirir. Mevcut auto-publish pipeline'ina veya statik content library'ye
// dokunmaz - yalniz "bu aday guvenle planlanabilir mi" sorusuna saf bir cevap uretir.

export interface RecentPost {
  villa: string;
  caption: string;
  mediaFile: string;
  scheduledDate: string; // YYYY-MM-DD
}

export interface DuplicateCandidate {
  villa: string;
  caption: string;
  mediaFile: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason: "exact_caption" | "exact_media" | "high_caption_similarity" | null;
  matchedPost: RecentPost | null;
  similarity: number; // 0-1, en yakin eslesmeyle
}

const HIGH_SIMILARITY_THRESHOLD = 0.85;

// Basit ama saglam bir Jaccard benzerligi (kelime kumesi kesisimi/birlesimi) - harici bir NLP
// kutuphanesi gerektirmez, deterministik ve test edilebilir. Tam ayni caption olmasa bile
// caption'in buyuk kismi tekrar ediyorsa (orn. yalniz tarih/emoji degismis) yakalar.
function wordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean));
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = wordSet(a);
  const setB = wordSet(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) if (setB.has(word)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// recentPosts: son 60 gunluk (cagiran taraf bu pencereyi uygular) ayni villa'nin gonderileri.
export function checkDuplicateContent(candidate: DuplicateCandidate, recentPosts: RecentPost[]): DuplicateCheckResult {
  const sameVillaPosts = recentPosts.filter((post) => post.villa === candidate.villa);

  const exactCaption = sameVillaPosts.find((post) => post.caption.trim() === candidate.caption.trim());
  if (exactCaption) return { isDuplicate: true, reason: "exact_caption", matchedPost: exactCaption, similarity: 1 };

  const exactMedia = sameVillaPosts.find((post) => post.mediaFile === candidate.mediaFile);
  if (exactMedia) return { isDuplicate: true, reason: "exact_media", matchedPost: exactMedia, similarity: 1 };

  let best: { post: RecentPost; similarity: number } | null = null;
  for (const post of sameVillaPosts) {
    const similarity = jaccardSimilarity(candidate.caption, post.caption);
    if (!best || similarity > best.similarity) best = { post, similarity };
  }

  if (best && best.similarity >= HIGH_SIMILARITY_THRESHOLD) {
    return { isDuplicate: true, reason: "high_caption_similarity", matchedPost: best.post, similarity: best.similarity };
  }

  return { isDuplicate: false, reason: null, matchedPost: null, similarity: best?.similarity ?? 0 };
}
