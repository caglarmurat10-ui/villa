import type { D1Database } from "@cloudflare/workers-types";
import {
  cachedRegionalIdea,
  getAiSettings,
  getVillaAiProfile,
  recentAiContext,
  recentAiTopics,
  saveAiHistory,
  saveRegionalIdea,
  saveWeeklyPlan,
  type AiSocialSettings,
} from "./aiDb";
import {
  AI_CONTENT_JSON_SCHEMA,
  REGIONAL_JSON_SCHEMA,
  aiContentOutputSchema,
  regionalResearchOutputSchema,
  validateAiVillaFacts,
  type AiMode,
  type AiPurpose,
  type RegionalResearchOutput,
} from "./aiTypes";
import { callStructuredResponse } from "./openaiResponses";
import type { Villa } from "./types";

const REGIONAL_BLOCKLIST = [
  "cinayet", "ölüm", "öldürüldü", "kaza", "suç", "şiddet", "siyaset", "seçim", "parti",
  "skandal", "magazin", "özel hayat", "dedikodu", "trajedi", "terör", "felaket",
];

export const REGIONAL_TOPICS = [
  "Patara Antik Kenti", "Patara Plajı", "Kaş", "Kalkan", "Kaputaş", "Saklıkent", "Xanthos",
  "Letoon", "Likya Yolu", "Kekova", "Kaleköy", "Yerel gastronomi", "Doğa", "Gün batımı",
  "Plajlar", "Tarihi alanlar", "Mevsimsel gezi önerileri",
] as const;

export function regionalTopicIsSafe(value: string) {
  const normalized = value.toLocaleLowerCase("tr-TR");
  return !REGIONAL_BLOCKLIST.some((term) => normalized.includes(term));
}

function boundedText(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function promptJson(value: unknown) {
  return JSON.stringify(value, null, 2).slice(0, 12_000);
}

export function chooseTodayCategory(
  mix: AiSocialSettings["contentMix"],
  recentCategories: string[],
  seed = new Date().toISOString().slice(0, 10),
) {
  const counts = recentCategories.reduce<Record<string, number>>((all, category) => {
    all[category] = (all[category] ?? 0) + 1;
    return all;
  }, {});
  const hash = [...seed].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 7);
  return Object.entries(mix).sort(([leftName, leftWeight], [rightName, rightWeight]) => {
    const leftScore = (counts[leftName] ?? 0) / Math.max(1, leftWeight);
    const rightScore = (counts[rightName] ?? 0) / Math.max(1, rightWeight);
    return leftScore - rightScore || rightWeight - leftWeight ||
      ((hash + leftName.length) % 17) - ((hash + rightName.length) % 17);
  })[0]?.[0] ?? "villa";
}

export async function todaySuggestion(db: D1Database, villa: Villa) {
  const settings = await getAiSettings(db, villa);
  let recentCategories: string[] = [];
  let historyAvailable = true;
  try { recentCategories = await recentAiTopics(db, villa); }
  catch { historyAvailable = false; }
  const category = chooseTodayCategory(settings.contentMix, recentCategories);
  const labels: Record<string, string> = {
    villa: "Villanın doğrulanmış özelliklerinden birini anlatın",
    regional: "Patara / Kaş çevresinden kaynaklı bir gezi fikri seçin",
    travel: "Misafirin tatil deneyimini kolaylaştıracak bir ipucu paylaşın",
    availability: "Yaklaşan gerçek müsaitlik aralığını değerlendirin",
    special: "Mevsime uygun bir Carousel veya Reels fikri hazırlayın",
  };
  const reason = recentCategories.length
    ? `${category} kategorisi son içeriklerde hedef dağılımının altında kaldı.`
    : "Henüz AI içerik geçmişi yok; dengeli bir başlangıç önerisi hazırlandı.";
  return { villa, category, suggestion: labels[category], reason, aiCallMade: false,
    enabled: settings.aiEnabled, autopilotLevel: settings.autopilotLevel, historyAvailable };
}

export function fallbackTodaySuggestion(villa: Villa) {
  return { villa, category: "villa", suggestion: "Villanın doğrulanmış özelliklerinden birini anlatın",
    reason: "Öneri verisi şu anda yüklenemedi; güvenli başlangıç fikri gösteriliyor.", aiCallMade: false,
    enabled: false, autopilotLevel: "off", historyAvailable: false } as const;
}

export async function generateAiContent(input: {
  db: D1Database;
  env: CloudflareEnv;
  villa: Villa;
  purpose: AiPurpose;
  mode: AiMode;
  userBrief: string;
  availability?: { startDate: string; endDate: string; nights: number; priceText?: string | null } | null;
  regionalIdea?: RegionalResearchOutput | null;
  mediaCategory?: string | null;
  weekly?: boolean;
}) {
  const [profile, settings, context] = await Promise.all([
    getVillaAiProfile(input.db, input.villa),
    getAiSettings(input.db, input.villa),
    recentAiContext(input.db, input.villa),
  ]);
  const system = `Türkçe Instagram içerik editörüsün. Sadece verilen doğrulanmış villa özelliklerini kullan.
Villa özellikleri uydurma; emin olmadığın her bilgiyi warnings alanına yaz ve metne ekleme.
villaClaims yalnızca doğrulanmış özellikler listesindeki cümlelerin birebir aynısını içerebilir.
Kaynaklı bölgesel bilgiyi villa özelliği gibi sunma. Abartılı garanti, sahte indirim veya yanıltıcı coğrafi iddia yazma.
Çıktıyı istenen JSON şemasına eksiksiz uydur. Ton: ${profile.tone}. Mod: ${input.mode}.`;
  const prompt = `Villa: ${input.villa}
Amaç: ${input.weekly ? "haftalık plan" : input.purpose}
Kullanıcı özeti: ${boundedText(input.userBrief, 1000) || "Özel bir ek istek yok."}
Doğrulanmış villa özellikleri: ${promptJson(profile.facts)}
Kesinlikle kullanılmayacak iddialar: ${promptJson(profile.prohibitedClaims)}
Müsaitlik/fiyat (yalnız varsa kullan): ${promptJson(input.availability ?? null)}
Bölgesel araştırma (yalnız kaynaklıysa kullan): ${promptJson(input.regionalIdea ?? null)}
Son içeriklerin tekrarından kaçın: ${promptJson(context.history.slice(0, 10))}
Son performans özeti, yalnız fikir önceliği için: ${promptJson(context.aggregatePerformance.slice(0, 20))}
İçerik dağılım hedefi: ${promptJson(settings.contentMix)}
${input.weekly ? "7 günlük dengeli bir weeklyPlan üret; diğer metin alanlarını da kısa bir plan özetiyle doldur." : "Caption, kısa caption, hikâyeleştirilmiş caption ve uygun Carousel/Reels taslağını üret."}`;
  const response = await callStructuredResponse({ db: input.db, env: input.env, villa: input.villa,
    operation: "text", schemaName: "villa_social_content", jsonSchema: AI_CONTENT_JSON_SCHEMA,
    validator: aiContentOutputSchema, system, prompt });
  const output = validateAiVillaFacts(response.value, profile);
  const id = await saveAiHistory(input.db, { villa: input.villa, purpose: input.purpose, mode: input.mode,
    mediaCategory: input.mediaCategory ?? null, output,
    sourceUrls: input.regionalIdea?.sourceUrls ?? [] });
  if (input.weekly) {
    const date = new Date();
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - ((date.getUTCDay() + 6) % 7)));
    await saveWeeklyPlan(input.db, input.villa, monday.toISOString().slice(0, 10), output);
  }
  return { id, output, model: response.model };
}

export function cachedResearch(row: Record<string, unknown>): RegionalResearchOutput | null {
  const parseArray = (value: unknown) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  };
  const candidate = {
    topic: row.topic,
    summary: row.summary,
    whyInteresting: row.content_angle,
    sourceUrls: row.sourceUrls ?? parseArray(row.source_urls_json),
    sourceTitles: row.sourceTitles ?? parseArray(row.source_titles_json),
    eventDate: row.event_date ?? null,
    expiresAt: row.expires_at,
    contentIdeas: row.contentIdeas ?? parseArray(row.content_ideas_json),
    category: "travel",
    relevanceScore: row.relevance_score,
    freshnessScore: row.freshness_score,
  };
  const parsed = regionalResearchOutputSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export async function researchRegionalTopic(input: {
  db: D1Database;
  env: CloudflareEnv;
  villa: Villa;
  topic: string;
  region?: string;
  forceRefresh?: boolean;
}) {
  const region = boundedText(input.region, 100) || "Patara, Kaş, Antalya";
  const topic = boundedText(input.topic, 160);
  if (!topic || !regionalTopicIsSafe(topic)) throw new Error("Bu konu bölgesel içerik güvenlik kurallarına uygun değil.");
  if (!input.forceRefresh) {
    const cached = await cachedRegionalIdea(input.db, region, topic);
    const value = cached ? cachedResearch(cached) : null;
    if (value) return { output: value, cached: true, model: null };
  }
  const system = `Patara ve Kaş için dikkatli bir turizm içerik araştırmacısısın.
Sadece güncel ve güvenilir web kaynaklarıyla doğrulayabildiğin bilgileri yaz.
Siyaset, suç, kaza, ölüm, trajedi, magazin, özel hayat, sansasyon ve doğrulanamayan etkinlikleri dışla.
Tarih veya etkinlik güncelse mutlaka kaynakla doğrula. Kaynaksız iddiayı çıktıdan çıkar.`;
  const prompt = `Bölge: ${region}\nKonu: ${topic}\nTurizm, kültür, doğa, tarih, gastronomi veya güvenli seyahat açısından Instagram içerik fikirleri araştır. En fazla 12 kaynak kullan.`;
  const response = await callStructuredResponse({ db: input.db, env: input.env, villa: input.villa,
    operation: "research", schemaName: "regional_content_research", jsonSchema: REGIONAL_JSON_SCHEMA,
    validator: regionalResearchOutputSchema, system, prompt, webSearch: true });
  if (!response.sources.length) throw new Error("Bölgesel araştırma doğrulanmış kaynak döndürmedi.");
  const now = Date.now();
  const output = regionalResearchOutputSchema.parse({ ...response.value,
    sourceUrls: response.sources.map((source) => source.url),
    sourceTitles: response.sources.map((source) => source.title),
    expiresAt: new Date(now + (response.value.eventDate ? 7 : 30) * 86_400_000).toISOString(),
  });
  if (!regionalTopicIsSafe(`${output.topic} ${output.summary} ${output.contentIdeas.join(" ")}`)) {
    throw new Error("Araştırma sonucu güvenli içerik filtresinden geçmedi.");
  }
  await saveRegionalIdea(input.db, output, region);
  return { output, cached: false, model: response.model };
}
