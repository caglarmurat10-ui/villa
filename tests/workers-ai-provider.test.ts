import { describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { deterministicSocialContent, generateSocialContent } from "@/lib/aiProviders";
import type { AiContentOutput, VillaAiProfile } from "@/lib/aiTypes";
import type { callStructuredResponse } from "@/lib/openaiResponses";

const profile: VillaAiProfile = {
  villa: "Destan",
  facts: ["Patara / Kaş bölgesinde konaklama"],
  prohibitedClaims: [],
  tone: "sıcak ve doğal",
};

const validOutput: AiContentOutput = {
  title: "Patara'da sakin bir mola",
  hook: "Tatil için kısa bir fikir",
  caption: "Patara / Kaş bölgesinde konaklama için bize ulaşın.",
  shortCaption: "Patara'da mola.",
  storytellingCaption: "Patara / Kaş bölgesinde konaklama için sakin bir gün hayal edin.",
  callToAction: "Bilgi için WhatsApp",
  hashtags: ["#Patara", "#VillaTatili"],
  contentType: "IMAGE",
  regionalTopic: null,
  warnings: [],
  villaClaims: ["Patara / Kaş bölgesinde konaklama"],
  contentIdeas: ["Doğrulanmış bir özelliği anlatın"],
  carouselSlides: [],
  reelsStoryboard: [],
  weeklyPlan: [],
};

function fakeDb() {
  const writes: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      let values: unknown[] = [];
      const statement = {
        bind: vi.fn((...next: unknown[]) => { values = next; return statement; }),
        first: vi.fn(async () => {
          if (sql.includes("FROM ai_social_settings")) return {
            villa: "Destan", ai_enabled: 1, daily_text_limit: 10, daily_research_limit: 5,
            image_enabled: 0, video_enabled: 0, autopilot_level: "off",
            content_mix_json: JSON.stringify({ villa: 35, regional: 25, travel: 15, availability: 15, special: 10 }),
          };
          if (sql.includes("COUNT(*) AS count")) return { count: 0 };
          if (sql.includes("open_until")) return null;
          if (sql.includes("failure_count")) return { failure_count: 0 };
          return null;
        }),
        run: vi.fn(async () => { writes.push({ sql, values }); return { meta: { changes: 1 } }; }),
        all: vi.fn(async () => ({ results: [] })),
      };
      return statement;
    }),
  };
  return { db: db as unknown as D1Database, writes };
}

function fakeKv() {
  const values = new Map<string, string>();
  return {
    get: vi.fn(async (key: string, type?: string) => {
      const value = values.get(key);
      return value && type === "json" ? JSON.parse(value) as unknown : value ?? null;
    }),
    put: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
  };
}

function providerInput(run: ReturnType<typeof vi.fn>, overrides: Record<string, unknown> = {}) {
  const { db, writes } = fakeDb();
  const kv = fakeKv();
  const env = {
    AI: { run },
    DB: db,
    SOCIAL_MEDIA_KV: kv,
    AI_PROVIDER: "workers-ai",
    AI_ALLOW_PAID_FALLBACK: "false",
    WORKERS_AI_TEXT_MODEL: "@cf/meta/llama-3.1-8b-instruct-fast",
    OPENAI_TEXT_MODEL: "mock-openai",
    AI_IMAGE_ENABLED: "false",
    AI_VIDEO_ENABLED: "false",
    ...overrides,
  } as unknown as CloudflareEnv;
  const template = deterministicSocialContent({ villa: "Destan", purpose: "villa", weekly: false, profile });
  return {
    input: { db, env, villa: "Destan" as const, purpose: "villa" as const, mode: "quick" as const,
      weekly: false, profile, system: "Yalnız doğrulanmış Türkçe içerik üret.", prompt: "Villa Destan için taslak üret.", template },
    writes,
    kv,
  };
}

describe("Cloudflare Workers AI içerik sağlayıcısı", () => {
  it("Workers AI'ı birincil sağlayıcı olarak kullanır ve Türkçe alanları normalize eder", async () => {
    const run = vi.fn(async () => ({ response: { ...validOutput, caption: "  Patara / Kaş   bölgesinde konaklama için bize ulaşın. ", hashtags: ["#Patara", "#Villa Tatili"] }, usage: { total_tokens: 31 } }));
    const { input } = providerInput(run);
    const result = await generateSocialContent(input);
    expect(result.provider).toBe("workers-ai");
    expect(result.output.caption).toBe("Patara / Kaş bölgesinde konaklama için bize ulaşın.");
    expect(result.output.hashtags).toContain("#VillaTatili");
    expect(run).toHaveBeenCalledOnce();
    const calls = run.mock.calls as unknown as Array<[string, Record<string, unknown>]>;
    expect(calls[0]?.[1]).toMatchObject({ response_format: {
      type: "json_schema", json_schema: { type: "object", additionalProperties: false },
    } });
    expect(JSON.stringify(calls[0]?.[1])).not.toContain('"strict"');
  });

  it("bozuk yapılandırılmış çıktıda güvenli şablona döner", async () => {
    const { input } = providerInput(vi.fn(async () => ({ response: "geçerli json değil" })));
    const result = await generateSocialContent(input);
    expect(result.provider).toBe("template");
    expect(result.output.warnings.join(" ")).toContain("güvenli hazır şablon");
  });

  it("Workers AI istisnasında güvenli şablona döner", async () => {
    const { input } = providerInput(vi.fn(async () => { throw new Error("network"); }));
    expect((await generateSocialContent(input)).provider).toBe("template");
  });

  it("OpenAI anahtarı olsa bile ücretli fallback kapalıyken OpenAI çağırmaz", async () => {
    const run = vi.fn(async () => { throw new Error("workers unavailable"); });
    const { input } = providerInput(run, { OPENAI_API_KEY: "never-return-this-key" });
    const openAiCaller = vi.fn();
    const result = await generateSocialContent(input, { openAiCaller: openAiCaller as unknown as typeof callStructuredResponse });
    expect(result.provider).toBe("template");
    expect(openAiCaller).not.toHaveBeenCalled();
  });

  it("ücretli fallback açıkken Workers AI hatasından sonra mock OpenAI kullanabilir", async () => {
    const run = vi.fn(async () => { throw new Error("workers unavailable"); });
    const { input } = providerInput(run, { OPENAI_API_KEY: "mock-key", AI_ALLOW_PAID_FALLBACK: "true" });
    const openAiCaller = vi.fn(async () => ({ value: validOutput, sources: [], model: "mock-openai" }));
    const result = await generateSocialContent(input, { openAiCaller: openAiCaller as unknown as typeof callStructuredResponse });
    expect(result.provider).toBe("openai");
    expect(openAiCaller).toHaveBeenCalledOnce();
  });

  it("Pexels yapılandırması olmadan Workers AI metin üretimini sürdürür", async () => {
    const { input } = providerInput(vi.fn(async () => ({ response: validOutput })));
    expect((await generateSocialContent(input)).provider).toBe("workers-ai");
  });

  it("uydurulmuş villa özelliğini reddedip şablona döner", async () => {
    const unsafe = { ...validOutput, caption: "Isıtmalı sonsuzluk havuzu keyfi.", villaClaims: ["Isıtmalı sonsuzluk havuzu"] };
    const { input } = providerInput(vi.fn(async () => ({ response: unsafe })));
    const result = await generateSocialContent(input);
    expect(result.provider).toBe("template");
    expect(result.output.caption).not.toContain("sonsuzluk havuzu");
  });

  it("başarılı Workers AI kullanımını servis, model ve token ile D1'e kaydeder", async () => {
    const { input, writes } = providerInput(vi.fn(async () => ({ response: validOutput, usage: { total_tokens: 52 } })));
    await generateSocialContent(input);
    const usage = writes.find((write) => write.sql.includes("INSERT INTO ai_usage_log"));
    expect(usage?.values).toEqual(expect.arrayContaining(["workers-ai", "text", "@cf/meta/llama-3.1-8b-instruct-fast", "Destan", 52, 1]));
  });

  it("aynı isteği KV cache'den döndürür; forceRefresh yeni Workers AI çağrısı yapar", async () => {
    const run = vi.fn(async () => ({ response: validOutput }));
    const { input, kv } = providerInput(run);
    expect((await generateSocialContent(input)).cached).toBe(false);
    expect((await generateSocialContent(input)).cached).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect((await generateSocialContent({ ...input, forceRefresh: true })).cached).toBe(false);
    expect(run).toHaveBeenCalledTimes(2);
    expect(kv.put).toHaveBeenCalled();
  });
});
