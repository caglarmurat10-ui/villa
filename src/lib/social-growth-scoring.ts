import type { ProspectCategory } from "./social-growth-store";
import { TARGET_LOCATIONS } from "./social-growth-constants";

// Meta insight verisi (gerçek followers/engagement) YOK - bu modül yalnız elimizdeki metadata'dan
// (kategori, konum ipucu, bio) sınırlı bir sezgisel (heuristic) skor üretir. followersCount/
// engagementScore burada KULLANILMAZ ve asla uydurulmaz - girişte null ise skor hesaplamasında da
// null kalır, "veri yokmuş gibi 0" ile "gerçekten 0" birbirine karıştırılmaz.

const CATEGORY_AUDIENCE_FIT: Record<ProspectCategory, number> = {
  travel_creator: 90,
  family_travel: 90,
  high_value_guest_source: 85,
  local_creator: 80,
  tourism_page: 75,
  lifestyle_creator: 60,
  photographer: 55,
  food_creator: 50,
  local_business: 45,
};

const THEME_KEYWORDS = [
  "villa", "tatil", "gezi", "seyahat", "travel", "holiday", "vacation", "guide", "rehber",
  "keşfet", "doğa", "plaj", "balayı", "aile", "family",
];

function normalizeTr(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u");
}

const NORMALIZED_TARGET_LOCATIONS = TARGET_LOCATIONS.map(normalizeTr);
// Patara/Kaş/Kalkan hedef lokasyonların bulunduğu geniş bölge - tam eşleşme kadar güçlü değil
// ama alakasız (ör. "İstanbul") olmadığını gösterir.
const REGIONAL_LOCATIONS = ["antalya", "mugla", "muğla"].map(normalizeTr);

export function computeLocationScore(locationHint: string | null): number | null {
  if (!locationHint || !locationHint.trim()) return null;
  const normalized = normalizeTr(locationHint.trim());
  if (NORMALIZED_TARGET_LOCATIONS.some((target) => normalized.includes(target))) return 100;
  if (REGIONAL_LOCATIONS.some((region) => normalized.includes(region))) return 55;
  return 15;
}

export function computeRelevanceScore(input: { category: ProspectCategory; bioSummary: string | null; locationHint: string | null }): number {
  let score = CATEGORY_AUDIENCE_FIT[input.category] ?? 40;
  const haystack = normalizeTr(`${input.bioSummary ?? ""} ${input.locationHint ?? ""}`);
  const matchedKeywords = THEME_KEYWORDS.filter((keyword) => haystack.includes(normalizeTr(keyword))).length;
  score += Math.min(15, matchedKeywords * 5);
  return Math.max(0, Math.min(100, score));
}

export function computeAudienceFitScore(category: ProspectCategory): number {
  return CATEGORY_AUDIENCE_FIT[category] ?? 40;
}

const SUSPICIOUS_USERNAME_PATTERN = /(\d{4,}|_{3,}|\.{2,})/;

export function computeSpamRiskScore(input: { username: string; bioSummary: string | null; sourceUrl: string | null }): number {
  let risk = 10;
  if (SUSPICIOUS_USERNAME_PATTERN.test(input.username)) risk += 40;
  if (!input.bioSummary?.trim() && !input.sourceUrl) risk += 25;
  return Math.max(0, Math.min(100, risk));
}

export type ScoreInput = {
  category: ProspectCategory;
  username: string;
  bioSummary: string | null;
  locationHint: string | null;
  sourceUrl: string | null;
};

export type ScoreBreakdown = {
  relevanceScore: number;
  locationScore: number | null;
  audienceFitScore: number;
  spamRiskScore: number;
  finalGrowthScore: number;
};

// finalGrowthScore yalnız MEVCUT bileşenlerin ağırlıklı ortalamasıdır - locationScore null ise
// (konum bilgisi hiç yoksa) o bileşen ağırlığı diğerlerine yeniden dağıtılır, 0 gibi ceza almaz.
export function computeScores(input: ScoreInput): ScoreBreakdown {
  const relevanceScore = computeRelevanceScore(input);
  const locationScore = computeLocationScore(input.locationHint);
  const audienceFitScore = computeAudienceFitScore(input.category);
  const spamRiskScore = computeSpamRiskScore(input);

  const weighted: Array<{ value: number; weight: number }> = [
    { value: relevanceScore, weight: 0.4 },
    { value: audienceFitScore, weight: 0.3 },
  ];
  if (locationScore !== null) weighted.push({ value: locationScore, weight: 0.3 });

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const positiveScore = weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
  const finalGrowthScore = Math.max(0, Math.round(positiveScore - spamRiskScore * 0.3));

  return { relevanceScore, locationScore, audienceFitScore, spamRiskScore, finalGrowthScore: Math.min(100, finalGrowthScore) };
}
