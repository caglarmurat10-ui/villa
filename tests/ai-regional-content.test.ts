import { describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { createAiAdminCookie, hasAiAdminSession } from "@/lib/aiAdminSession";
import { aiAutopilotDecision } from "@/lib/aiActivity";
import { assertAiBudget } from "@/lib/aiDb";
import { cachedResearch, chooseTodayCategory, regionalTopicIsSafe } from "@/lib/aiContentStudio";
import { AI_CONTENT_JSON_SCHEMA, aiContentOutputSchema, validateAiVillaFacts, type AiContentOutput } from "@/lib/aiTypes";
import { callStructuredResponse, responseSources } from "@/lib/openaiResponses";
import { safeIllustrationPrompt } from "@/lib/openaiImage";
import { parsePexelsPhotos, pexelsGeographicClaim, searchPexels } from "@/lib/pexels";

function fakeDb(used = 0) {
  const db = {
    batch: vi.fn(async () => []),
    prepare: vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () => {
          if (sql.includes("FROM ai_social_settings")) return { villa: "Destan", ai_enabled: 1, daily_text_limit: 2,
            daily_research_limit: 1, image_enabled: 0, video_enabled: 0, autopilot_level: "off",
            content_mix_json: JSON.stringify({ villa: 35, regional: 25, travel: 15, availability: 15, special: 10 }) };
          if (sql.includes("COUNT(*) AS count")) return { count: used };
          if (sql.includes("open_until")) return null;
          if (sql.includes("failure_count")) return { failure_count: 0 };
          return null;
        }),
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
        all: vi.fn(async () => ({ results: [] })),
      };
      return statement;
    }),
  };
  return db as unknown as D1Database;
}

const env = {
  OPENAI_API_KEY: "test-key-never-logged", OPENAI_TEXT_MODEL: "test-model", OPENAI_IMAGE_MODEL: "test-image",
  AI_IMAGE_ENABLED: "false", AI_VIDEO_ENABLED: "false", SOCIAL_AI_ADMIN_KEY: "a-strong-test-admin-key",
} as unknown as CloudflareEnv;

const validOutput: AiContentOutput = {
  title: "Patara'da sakin bir mola", hook: "Tatil için kısa bir fikir", caption: "Patara çevresinde sakin bir mola için bize ulaşın.",
  shortCaption: "Patara'da mola.", storytellingCaption: "Patara çevresinde sakin bir gün hayal edin.",
  callToAction: "Bilgi için WhatsApp", hashtags: ["#Patara", "#VillaTatili"], contentType: "IMAGE",
  regionalTopic: null, warnings: [], villaClaims: ["Patara / Kaş bölgesinde konaklama"], contentIdeas: [],
  carouselSlides: [], reelsStoryboard: [], weeklyPlan: [],
};

describe("AI structured output ve güvenlik", () => {
  it("Responses API yapılandırılmış JSON çıktısını şemayla doğrular", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(validOutput) }] }], usage: { total_tokens: 42 } }), { status: 200 }));
    const result = await callStructuredResponse({ db: fakeDb(), env, villa: "Destan", operation: "text",
      schemaName: "test_content", jsonSchema: AI_CONTENT_JSON_SCHEMA, validator: aiContentOutputSchema,
      system: "test", prompt: "test", fetcher });
    expect(result.value.title).toBe(validOutput.title); expect(result.model).toBe("test-model");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("uydurulmuş villa özelliğini reddeder", () => {
    expect(() => validateAiVillaFacts({ ...validOutput, villaClaims: ["Isıtmalı sonsuzluk havuzu"],
      caption: "Isıtmalı havuz keyfi" }, { villa: "Destan", facts: ["Patara / Kaş bölgesinde konaklama"], prohibitedClaims: [], tone: "warm" })).toThrow("doğrulanmamış");
  });

  it("OpenAI hatasında mevcut sistem için güvenli fallback mesajı verir", async () => {
    const fetcher = vi.fn(async () => new Response("unavailable", { status: 503 }));
    await expect(callStructuredResponse({ db: fakeDb(), env, villa: "Destan", operation: "text",
      schemaName: "test_content", jsonSchema: AI_CONTENT_JSON_SCHEMA, validator: aiContentOutputSchema,
      system: "test", prompt: "test", fetcher })).rejects.toThrow("Hazır şablonlarla");
  });

  it("günlük AI limitini çağrıdan önce uygular", async () => {
    await expect(assertAiBudget(fakeDb(2), "Destan", "text")).rejects.toThrow("limit");
  });

  it("AI autopilot varsayılan kapalıdır ve 48 saat sessizlik sınırını korur", () => {
    const settings = { villa: "Destan" as const, aiEnabled: false, dailyTextLimit: 5, dailyResearchLimit: 2,
      imageEnabled: false, videoEnabled: false, autopilotLevel: "off" as const,
      contentMix: { villa: 35, regional: 25, travel: 15, availability: 15, special: 10 } };
    expect(aiAutopilotDecision(settings, null).reason).toBe("disabled");
    expect(aiAutopilotDecision({ ...settings, aiEnabled: true, autopilotLevel: "suggestion" },
      "2026-08-25T20:00:00.000Z", new Date("2026-08-26T10:00:00.000Z")).reason).toBe("recent-content");
  });

  it("yönetici oturumunu imzalı HttpOnly cookie ile doğrular", async () => {
    const cookie = await createAiAdminCookie(env); expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("SameSite=Strict");
    const request = new Request("https://villa.example/api/social/ai/settings", { headers: { cookie: cookie.split(";")[0] } });
    expect(await hasAiAdminSession(request, env)).toBe(true);
  });
});

describe("bölgesel araştırma, cache ve kaynak", () => {
  it("web search kaynaklarını HTTPS provenance olarak çıkarır", () => {
    expect(responseSources({ output: [{ action: { sources: [{ url: "https://muze.gov.tr/patara", title: "Patara" }, { url: "http://unsafe.test", title: "Unsafe" }] } }] })).toEqual([
      { url: "https://muze.gov.tr/patara", title: "Patara" },
    ]);
  });

  it("politika, suç ve trajediyi içerik adayından çıkarır", () => {
    expect(regionalTopicIsSafe("Patara Antik Kenti gezi önerisi")).toBe(true);
    expect(regionalTopicIsSafe("Kaş seçim ve suç haberi")).toBe(false);
  });

  it("geçerli D1 cache kaydını yeniden kullanıma hazırlar", () => {
    const output = cachedResearch({ topic: "Patara", summary: "Kaynaklı özet", content_angle: "Gezi fikri",
      source_urls_json: JSON.stringify(["https://example.org/patara"]), source_titles_json: JSON.stringify(["Kaynak"]),
      content_ideas_json: JSON.stringify(["Bir gezi carousel'i"]), event_date: null,
      expires_at: "2026-09-20T00:00:00.000Z", relevance_score: 90, freshness_score: 80 });
    expect(output?.sourceUrls).toEqual(["https://example.org/patara"]);
  });

  it("içerik dağılımında eksik kalan sütunu öne alır", () => {
    expect(chooseTodayCategory({ villa: 35, regional: 25, travel: 15, availability: 15, special: 10 },
      ["villa", "villa", "regional", "travel"], "2026-08-26")).toBe("availability");
  });
});

describe("Pexels ve AI medya güvenliği", () => {
  it("Pexels attribution ve konum metadata'sını korur", () => {
    const result = parsePexelsPhotos([{ id: 42, url: "https://www.pexels.com/photo/42", photographer: "Ada",
      photographer_url: "https://www.pexels.com/@ada", alt: "Patara beach at sunset", src: { large: "https://images.pexels.com/photos/42.jpeg" } }]);
    expect(result[0]).toMatchObject({ id: "42", photographer: "Ada", licenseSource: "Pexels", geographicClaim: "Patara" });
    expect(pexelsGeographicClaim("Mediterranean coast")).toContain("doğrulanmadı");
  });

  it("Pexels hatasında villa medya kütüphanesini etkilemeyen fallback verir", async () => {
    const fetcher = vi.fn(async () => new Response("unavailable", { status: 503 }));
    await expect(searchPexels({ ...env, PEXELS_API_KEY: "test" } as CloudflareEnv,
      { query: "Patara", kind: "photo" }, fetcher)).rejects.toThrow("ulaşılamıyor");
  });

  it("AI görsel promptuna gerçek villa görünümü uydurmama kuralını ekler", () => {
    expect(safeIllustrationPrompt("Safira", "Akdeniz temalı afiş")).toContain("gerçek dış veya iç görünüşünü");
  });
});
