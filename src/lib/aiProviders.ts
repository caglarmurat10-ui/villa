import type { D1Database } from "@cloudflare/workers-types";
import {
  configuredAiProvider,
  hasOpenAiConfiguration,
  hasWorkersAiConfiguration,
  isPaidAiFallbackAllowed,
  workersAiModel,
  type AiProviderName,
} from "./aiConfiguration";
import { aiCircuitOpen, assertAiBudget, logAiUsage, recordAiServiceResult } from "./aiDb";
import {
  AI_CONTENT_JSON_SCHEMA,
  REGIONAL_JSON_SCHEMA,
  aiContentOutputSchema,
  regionalResearchOutputSchema,
  validateAiVillaFacts,
  type AiContentOutput,
  type AiMode,
  type AiPurpose,
  type RegionalResearchOutput,
  type VillaAiProfile,
} from "./aiTypes";
import { callStructuredResponse } from "./openaiResponses";
import type { Villa } from "./types";

const CONTENT_CACHE_PREFIX = "ai:content-cache:v1:";
const CONTENT_CACHE_TTL_SECONDS = 30 * 60;
const TEMPLATE_MODEL = "deterministic-template-v1";

type WorkersAiUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
type WorkersAiResponse = { response?: unknown; usage?: WorkersAiUsage };

export type SocialContentProviderResult = {
  provider: AiProviderName;
  output: AiContentOutput;
  model: string;
  warnings: string[];
  cached: boolean;
};

export type RegionalContentProviderResult = {
  provider: AiProviderName;
  output: RegionalResearchOutput;
  model: string;
  warnings: string[];
};

type OpenAiCaller = typeof callStructuredResponse;

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function stringList(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
      .map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseJsonCandidate(value: unknown) {
  if (recordValue(value)) return value;
  if (typeof value !== "string") throw new Error("Workers AI geçerli JSON döndürmedi.");
  const withoutFence = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Workers AI geçerli JSON döndürmedi.");
  const json = withoutFence.slice(start, end + 1);
  try { return JSON.parse(json) as unknown; }
  catch { return JSON.parse(json.replace(/,\s*([}\]])/g, "$1")) as unknown; }
}

function repairContentCandidate(value: unknown, purpose: AiPurpose, weekly: boolean) {
  const record = recordValue(value);
  if (!record) return value;
  const caption = cleanText(record.caption, 2200);
  const hashtags = stringList(record.hashtags, 20, 80)
    .map((tag) => `#${tag.replace(/^#+/, "").replace(/\s+/g, "")}`).filter((tag) => tag.length > 1);
  return {
    ...record,
    title: cleanText(record.title, 160),
    hook: cleanText(record.hook, 240),
    caption,
    shortCaption: cleanText(record.shortCaption, 600) || caption.slice(0, 600),
    storytellingCaption: cleanText(record.storytellingCaption, 2200) || caption,
    callToAction: cleanText(record.callToAction, 300) || "Rezervasyon ve bilgi için DM / WhatsApp.",
    hashtags,
    contentType: weekly ? "WEEKLY_PLAN" : record.contentType ?? contentTypeForPurpose(purpose),
    regionalTopic: typeof record.regionalTopic === "string" ? cleanText(record.regionalTopic, 160) : null,
    warnings: stringList(record.warnings, 10, 300),
    villaClaims: stringList(record.villaClaims, 30, 240),
    contentIdeas: stringList(record.contentIdeas, 12, 240),
    carouselSlides: stringList(record.carouselSlides, 10, 240),
    reelsStoryboard: Array.isArray(record.reelsStoryboard) ? record.reelsStoryboard : [],
    weeklyPlan: Array.isArray(record.weeklyPlan) ? record.weeklyPlan : [],
  };
}

function contentTypeForPurpose(purpose: AiPurpose): AiContentOutput["contentType"] {
  if (purpose === "reels") return "REELS";
  if (purpose === "carousel") return "CAROUSEL";
  if (purpose === "story") return "STORY_IDEA";
  return "IMAGE";
}

export function normalizeSocialContent(value: unknown, purpose: AiPurpose, weekly: boolean) {
  return aiContentOutputSchema.parse(repairContentCandidate(parseJsonCandidate(value), purpose, weekly));
}

function templateWeeklyPlan(villa: Villa, fact: string) {
  const days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  const types = ["IMAGE", "CAROUSEL", "STORY_IDEA", "IMAGE", "REELS", "CAROUSEL", "STORY_IDEA"] as const;
  return days.map((day, index) => ({ day, villa, contentType: types[index], topic: index === 0 ? fact : `${villa} için ${day.toLocaleLowerCase("tr-TR")} içerik fikri`,
    mediaCategory: "Villa", reason: "Dengeli ve kontrollü haftalık içerik dağılımı." }));
}

export function deterministicSocialContent(input: {
  villa: Villa;
  purpose: AiPurpose;
  weekly: boolean;
  profile: VillaAiProfile;
  availability?: { startDate: string; endDate: string; nights: number; priceText?: string | null } | null;
  regionalTopic?: string | null;
}): AiContentOutput {
  const fact = input.profile.facts[0]?.trim() || `Villa ${input.villa}`;
  const availability = input.availability
    ? ` ${input.availability.startDate}–${input.availability.endDate} tarihleri için ${input.availability.nights} gecelik müsaitlik bulunuyor.`
    : "";
  const regional = input.regionalTopic ? ` ${input.regionalTopic} çevresini keşfetmek isteyenler için sakin bir konaklama fikri.` : "";
  const hook = input.purpose === "reels" ? "Kısa bir tatil molasına ne dersiniz?"
    : input.purpose === "carousel" ? "Tatil planınızı adım adım hazırlayın."
      : `Villa ${input.villa} için sade bir tatil fikri.`;
  const caption = `${fact}.${availability}${regional} Rezervasyon ve bilgi için DM / WhatsApp.`.replace(/\.\./g, ".").trim();
  const contentType = input.weekly ? "WEEKLY_PLAN" : contentTypeForPurpose(input.purpose);
  const carouselSlides = contentType === "CAROUSEL"
    ? [`Villa ${input.villa}`, fact, "Tarih ve ayrıntılar için bize ulaşın"]
    : [];
  const reelsStoryboard = contentType === "REELS" ? [
    { startSecond: 0, endSecond: 5, scene: "Villa medya kütüphanesinden genel açılış görüntüsü", overlayText: hook, voiceOver: hook },
    { startSecond: 5, endSecond: 12, scene: "Yalnız doğrulanmış villa detaylarını gösteren görüntüler", overlayText: fact, voiceOver: fact },
    { startSecond: 12, endSecond: 15, scene: "Sade iletişim kapanışı", overlayText: "Bilgi için DM / WhatsApp", voiceOver: "Ayrıntılar için bize ulaşabilirsiniz." },
  ] : [];
  return aiContentOutputSchema.parse({
    title: `Villa ${input.villa} içerik taslağı`, hook, caption, shortCaption: `${hook} ${fact}.`,
    storytellingCaption: caption, callToAction: "Rezervasyon ve bilgi için DM / WhatsApp.",
    hashtags: ["#Patara", "#Kaş", "#VillaTatili"], contentType,
    regionalTopic: input.regionalTopic ?? null,
    warnings: ["Cloudflare Workers AI kullanılamadığı için güvenli hazır şablon kullanıldı."],
    villaClaims: input.profile.facts.includes(fact) ? [fact] : [],
    contentIdeas: ["Doğrulanmış bir villa özelliğini sade bir görselle anlatın."], carouselSlides, reelsStoryboard,
    weeklyPlan: input.weekly ? templateWeeklyPlan(input.villa, fact) : [],
  });
}

async function cacheDigest(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function contentCacheKey(input: { env: CloudflareEnv; villa: Villa; system: string; prompt: string }) {
  const identity = JSON.stringify({ provider: configuredAiProvider(input.env), workersModel: workersAiModel(input.env),
    openAiModel: input.env.OPENAI_TEXT_MODEL, villa: input.villa, system: input.system, prompt: input.prompt });
  return `${CONTENT_CACHE_PREFIX}${await cacheDigest(identity)}`;
}

async function readContentCache(env: CloudflareEnv, key: string): Promise<SocialContentProviderResult | null> {
  try {
    const value = await env.SOCIAL_MEDIA_KV.get<unknown>(key, "json");
    const record = recordValue(value);
    const output = aiContentOutputSchema.safeParse(record?.output);
    const provider = record?.provider;
    if (!output.success || (provider !== "workers-ai" && provider !== "openai")) return null;
    return { provider, output: output.data, model: cleanText(record?.model, 160),
      warnings: stringList(record?.warnings, 10, 300), cached: true };
  } catch { return null; }
}

async function writeContentCache(env: CloudflareEnv, key: string, result: SocialContentProviderResult) {
  try {
    await env.SOCIAL_MEDIA_KV.put(key, JSON.stringify({ provider: result.provider, output: result.output,
      model: result.model, warnings: result.warnings }), { expirationTtl: CONTENT_CACHE_TTL_SECONDS });
  } catch { /* Cache arızası içerik üretimini durdurmaz. */ }
}

export async function callWorkersAiStructured<T>(input: {
  db: D1Database;
  env: CloudflareEnv;
  villa: Villa;
  operation: "text" | "research";
  jsonSchema: Record<string, unknown>;
  parser: (value: unknown) => T;
  system: string;
  prompt: string;
  maxTokens?: number;
}) {
  if (!hasWorkersAiConfiguration(input.env)) throw new Error("Cloudflare Workers AI kullanılamıyor.");
  await assertAiBudget(input.db, input.villa, input.operation);
  if (await aiCircuitOpen(input.db, "workers-ai")) throw new Error("Cloudflare Workers AI geçici olarak dinlenmede.");
  const model = workersAiModel(input.env);
  let attempted = false;
  let success = false;
  let units = 0;
  try {
    attempted = true;
    const raw = await input.env.AI.run(model, {
      messages: [{ role: "system", content: input.system }, { role: "user", content: input.prompt }],
      response_format: { type: "json_schema", json_schema: input.jsonSchema },
      temperature: 0.4,
      max_tokens: input.maxTokens ?? 1800,
    });
    const response = raw as WorkersAiResponse;
    units = response.usage?.total_tokens ?? 0;
    const value = input.parser(parseJsonCandidate(response.response));
    success = true;
    await recordAiServiceResult(input.db, "workers-ai", true).catch(() => undefined);
    return { value, model, units };
  } catch {
    await recordAiServiceResult(input.db, "workers-ai", false).catch(() => undefined);
    throw new Error("Cloudflare Workers AI şu anda yanıt veremedi.");
  } finally {
    if (attempted) {
      await logAiUsage(input.db, { service: "workers-ai", operation: input.operation, model,
        villa: input.villa, estimatedUnits: units, success }).catch(() => undefined);
    }
  }
}

export async function generateSocialContent(input: {
  db: D1Database;
  env: CloudflareEnv;
  villa: Villa;
  purpose: AiPurpose;
  mode: AiMode;
  weekly: boolean;
  profile: VillaAiProfile;
  system: string;
  prompt: string;
  template: AiContentOutput;
  forceRefresh?: boolean;
}, dependencies: { openAiCaller?: OpenAiCaller } = {}): Promise<SocialContentProviderResult> {
  const cacheKey = await contentCacheKey(input);
  if (!input.forceRefresh) {
    const cached = await readContentCache(input.env, cacheKey);
    if (cached) {
      try { return { ...cached, output: validateAiVillaFacts(cached.output, input.profile) }; }
      catch { /* Eski veya geçersiz önbellek girdisi yerine yeni güvenli çıktı üretilir. */ }
    }
  }

  const primary = configuredAiProvider(input.env);
  let workersFailed = false;
  if (primary === "workers-ai" && hasWorkersAiConfiguration(input.env)) {
    try {
      const response = await callWorkersAiStructured({ db: input.db, env: input.env, villa: input.villa,
        operation: "text", jsonSchema: AI_CONTENT_JSON_SCHEMA,
        parser: (value) => validateAiVillaFacts(normalizeSocialContent(value, input.purpose, input.weekly), input.profile),
        system: input.system, prompt: input.prompt, maxTokens: input.weekly ? 2400 : 1800 });
      const result: SocialContentProviderResult = { provider: "workers-ai",
        output: response.value, model: response.model,
        warnings: response.value.warnings, cached: false };
      await writeContentCache(input.env, cacheKey, result);
      return result;
    } catch { workersFailed = true; }
  }

  const openAiAllowed = isPaidAiFallbackAllowed(input.env) && hasOpenAiConfiguration(input.env);
  if ((primary === "openai" || (primary === "workers-ai" && workersFailed)) && openAiAllowed) {
    try {
      const response = await (dependencies.openAiCaller ?? callStructuredResponse)({ db: input.db, env: input.env,
        villa: input.villa, operation: "text", schemaName: "villa_social_content", jsonSchema: AI_CONTENT_JSON_SCHEMA,
        validator: aiContentOutputSchema, system: input.system, prompt: input.prompt });
      const result: SocialContentProviderResult = { provider: "openai",
        output: validateAiVillaFacts(response.value, input.profile), model: response.model,
        warnings: [...response.value.warnings, "Ücretli OpenAI alternatifi kullanıldı."], cached: false };
      await writeContentCache(input.env, cacheKey, result);
      return result;
    } catch { /* Ücretli alternatif de başarısızsa güvenli şablona geçilir. */ }
  }

  const output = validateAiVillaFacts(input.template, input.profile);
  return { provider: "template", output, model: TEMPLATE_MODEL, warnings: output.warnings, cached: false };
}

function deterministicRegionalContent(topic: string, region: string): RegionalResearchOutput {
  const now = Date.now();
  return regionalResearchOutputSchema.parse({
    topic,
    summary: `${topic}, ${region} çevresinde genel bir gezi içeriği için değerlendirilebilir. Ziyaret öncesinde güncel koşullar resmî kaynaklardan ayrıca kontrol edilmelidir.`,
    whyInteresting: "Bölgenin doğa, tarih ve gezi deneyimini abartısız bir dille anlatmaya uygundur.",
    sourceUrls: [], sourceTitles: [], eventDate: null,
    expiresAt: new Date(now + 30 * 86_400_000).toISOString(),
    contentIdeas: [
      `${topic} için kaydırmalı genel gezi önerisi`,
      "Villa konaklamasıyla birlikte sakin bir bölge keşfi fikri",
      "Takipçilere güncel bilgileri resmî kaynaklardan kontrol etmelerini hatırlatan kısa içerik",
    ],
    category: "travel", relevanceScore: 70, freshnessScore: 40,
  });
}

function containsUnverifiedCurrentClaim(output: RegionalResearchOutput) {
  const text = `${output.summary}\n${output.whyInteresting}\n${output.contentIdeas.join("\n")}`.toLocaleLowerCase("tr-TR");
  return /(?:\b\d{1,2}[:.]\d{2}\b|₺|\btl\b|\blira\b|giriş ücreti|bilet fiyat|açılış saati|kapanış saati|yol durumu|etkinlik tarihi|\b20\d{2}\b)/i.test(text);
}

function normalizeRegionalWorkersOutput(value: unknown, now = new Date()) {
  const record = recordValue(value);
  if (!record) throw new Error("Workers AI bölgesel içerik döndürmedi.");
  const parsed = regionalResearchOutputSchema.parse({ ...record, sourceUrls: [], sourceTitles: [], eventDate: null,
    expiresAt: new Date(now.getTime() + 30 * 86_400_000).toISOString() });
  if (containsUnverifiedCurrentClaim(parsed)) throw new Error("Workers AI doğrulanmamış güncel bilgi üretti.");
  return parsed;
}

export async function generateRegionalContent(input: {
  db: D1Database;
  env: CloudflareEnv;
  villa: Villa;
  topic: string;
  region: string;
  system: string;
  prompt: string;
}, dependencies: { openAiCaller?: OpenAiCaller } = {}): Promise<RegionalContentProviderResult> {
  const primary = configuredAiProvider(input.env);
  let workersFailed = false;
  if (primary === "workers-ai" && hasWorkersAiConfiguration(input.env)) {
    try {
      const response = await callWorkersAiStructured({ db: input.db, env: input.env, villa: input.villa,
        operation: "research", jsonSchema: REGIONAL_JSON_SCHEMA,
        parser: (value) => normalizeRegionalWorkersOutput(value), system: input.system, prompt: input.prompt, maxTokens: 1200 });
      return { provider: "workers-ai", output: response.value, model: response.model,
        warnings: ["Güncel saat, ücret, etkinlik ve yol bilgisi kullanılmadı; gerektiğinde resmî kaynaklardan kontrol edilmelidir."] };
    } catch { workersFailed = true; }
  }

  const openAiAllowed = isPaidAiFallbackAllowed(input.env) && hasOpenAiConfiguration(input.env);
  if ((primary === "openai" || (primary === "workers-ai" && workersFailed)) && openAiAllowed) {
    try {
      const response = await (dependencies.openAiCaller ?? callStructuredResponse)({ db: input.db, env: input.env,
        villa: input.villa, operation: "research", schemaName: "regional_content_research",
        jsonSchema: REGIONAL_JSON_SCHEMA, validator: regionalResearchOutputSchema,
        system: input.system, prompt: input.prompt, webSearch: true });
      const output = regionalResearchOutputSchema.parse({ ...response.value,
        sourceUrls: response.sources.map((source) => source.url), sourceTitles: response.sources.map((source) => source.title) });
      if (!response.sources.length) throw new Error("OpenAI doğrulanmış kaynak döndürmedi.");
      return { provider: "openai", output, model: response.model, warnings: ["Ücretli OpenAI web araştırması kullanıldı."] };
    } catch { /* Güvenli bölgesel şablona geçilir. */ }
  }

  return { provider: "template", output: deterministicRegionalContent(input.topic, input.region), model: TEMPLATE_MODEL,
    warnings: ["AI sağlayıcısı kullanılamadığı için güncel iddia içermeyen güvenli bölge şablonu kullanıldı."] };
}
