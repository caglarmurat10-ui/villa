import { readFileSync } from "node:fs";
import type { D1Database } from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAiAdminCookie } from "@/lib/aiAdminSession";
import { publicAiError, readAiD1 } from "@/lib/aiD1";
import { aiUsageSummary, getAiSettings, getVillaAiProfile, listRegionalIdeas, recentAiContext, recentAiTopics } from "@/lib/aiDb";
import { generateAiContent, todaySuggestion } from "@/lib/aiContentStudio";

type Query = { sql: string; args: unknown[] };
type FakeOptions = { failOn?: string; topicRows?: number };

function fakeDb(options: FakeOptions = {}) {
  const queries: Query[] = [];
  const db = {
    prepare(sql: string) {
      const query: Query = { sql, args: [] }; queries.push(query);
      const fail = () => {
        if (options.failOn && sql.includes(options.failOn)) {
          throw new Error("D1_ERROR: D1 DB storage operation exceeded timeout which caused object to be reset.");
        }
      };
      const statement = {
        bind(...args: unknown[]) { query.args = args; return statement; },
        async first() {
          fail();
          if (sql.includes("FROM ai_social_settings")) return { villa: "Destan", ai_enabled: 1, daily_text_limit: 5,
            daily_research_limit: 2, image_enabled: 0, video_enabled: 0, autopilot_level: "off",
            content_mix_json: JSON.stringify({ villa: 35, regional: 25, travel: 15, availability: 15, special: 10 }) };
          return null;
        },
        async all() {
          fail();
          if (sql.includes("SELECT topic FROM ai_content_history")) {
            return { results: Array.from({ length: options.topicRows ?? 0 }, (_, index) => ({ topic: `topic-${index}` })) };
          }
          return { results: [] };
        },
        async run() { return { meta: { changes: 1 } }; },
      };
      return statement;
    },
  };
  return { db: db as unknown as D1Database, queries };
}

const routeState = vi.hoisted(() => ({
  db: null as D1Database | null,
  env: { OPENAI_API_KEY: "mock-openai", PEXELS_API_KEY: "mock-pexels", SOCIAL_AI_ADMIN_KEY: "mock-admin-key-long-enough",
    AI_IMAGE_ENABLED: "false", AI_VIDEO_ENABLED: "false" } as unknown as CloudflareEnv,
}));

vi.mock("@/lib/socialOperationsDb", () => ({
  socialOperationsDb: vi.fn(async () => ({ db: routeState.db, env: routeState.env })),
}));

import { GET as getAiSettingsRoute } from "@/app/api/social/ai/settings/route";
import { GET as getTodayRoute } from "@/app/api/social/ai/today/route";
import { GET as getResearchRoute } from "@/app/api/social/ai/research/route";

async function authenticatedRequest(path: string) {
  const cookie = await createAiAdminCookie(routeState.env);
  return new Request(`https://villa.example${path}`, { headers: { cookie: cookie.split(";")[0] } });
}

describe("AI D1 request hot path", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("AI okumalarında request-time DDL veya schema introspection çalıştırmaz", async () => {
    const fake = fakeDb();
    await getAiSettings(fake.db, "Destan");
    await getVillaAiProfile(fake.db, "Destan");
    await recentAiTopics(fake.db, "Destan");
    await recentAiContext(fake.db, "Destan");
    await listRegionalIdeas(fake.db);
    await aiUsageSummary(fake.db, new Date("2026-08-27T10:00:00.000Z"));
    expect(fake.queries.some(({ sql }) => /\b(CREATE|ALTER|PRAGMA)\b/i.test(sql))).toBe(false);
  });

  it("1000+ history satırı olsa da öneri sorgusunu ve sonucunu 20 kayıtla sınırlar", async () => {
    const fake = fakeDb({ topicRows: 1_200 });
    const topics = await recentAiTopics(fake.db, "Destan", 1_200);
    const query = fake.queries.find(({ sql }) => sql.includes("SELECT topic FROM ai_content_history"));
    expect(query?.sql).toContain("LIMIT ?");
    expect(query?.args).toEqual(["Destan", 20]);
    expect(topics).toHaveLength(20);
  });

  it("generation context yalnız sınırlı history/performance kolonlarını okur", async () => {
    const fake = fakeDb();
    await recentAiContext(fake.db, "Safira");
    const history = fake.queries.find(({ sql }) => sql.includes("FROM ai_content_history"));
    const performance = fake.queries.find(({ sql }) => sql.includes("FROM instagram_media_insights"));
    expect(history?.sql).not.toContain("output_json");
    expect(history?.args).toEqual(["Safira", 20]);
    expect(performance?.args.at(-1)).toBe(20);
  });

  it("history timeout olduğunda güvenli öneri üretmeye devam eder", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fake = fakeDb({ failOn: "SELECT topic FROM ai_content_history" });
    const suggestion = await todaySuggestion(fake.db, "Destan");
    expect(suggestion).toMatchObject({ villa: "Destan", historyAvailable: false });
    expect(suggestion.suggestion).toBeTruthy();
  });

  it("generation history timeout olduğunda doğrulanmış profil ve şablonla taslak döndürür", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fake = fakeDb({ failOn: "FROM ai_content_history" });
    const result = await generateAiContent({ db: fake.db,
      env: { AI_PROVIDER: "template", AI_IMAGE_ENABLED: "false", AI_VIDEO_ENABLED: "false" } as unknown as CloudflareEnv,
      villa: "Destan", purpose: "villa", mode: "quick", userBrief: "Sade bir içerik" });
    expect(result.provider).toBe("template");
    expect(result.output.caption).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("D1_ERROR");
  });

  it("safe read timeout için yalnız bir kısa retry yapar", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const operation = vi.fn(async () => { throw new Error("D1_ERROR: storage operation exceeded timeout; object to be reset"); });
    await expect(readAiD1("ai-history", operation)).rejects.toThrow("D1_ERROR");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("internal D1 hata metnini kullanıcı cevabına sızdırmaz", () => {
    const internal = new Error("D1_ERROR: D1 DB storage operation exceeded timeout which caused object to be reset.");
    const message = publicAiError(internal, "İçerik geçmişi şu anda yüklenemedi.");
    expect(message).toBe("İçerik geçmişi şu anda yüklenemedi.");
    expect(message).not.toMatch(/D1_ERROR|storage operation|object to be reset/i);
  });

  it("gerekli query indexlerini idempotent migration olarak tanımlar", () => {
    const migration = readFileSync("migrations/0006_ai_query_indexes.sql", "utf8");
    expect(migration.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(3);
    expect(migration).toContain("instagram_media_insights_villa_published_idx");
    expect(migration).toContain("regional_content_recent_idx");
  });
});

describe("AI Studio bölüm bazlı fallback", () => {
  it("empty DB ile settings/config ekranını açar", async () => {
    routeState.db = fakeDb().db;
    const response = await getAiSettingsRoute(await authenticatedRequest("/api/social/ai/settings"));
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ configured: true, availability: { settings: true, usage: true } });
    expect(body.items).toHaveLength(2);
  });

  it("usage sorgusu hata verse de config ve form ayarlarını döndürür", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    routeState.db = fakeDb({ failOn: "FROM ai_usage_log WHERE daily_key>=" }).db;
    const response = await getAiSettingsRoute(await authenticatedRequest("/api/social/ai/settings"));
    const body = await response.json() as { availability: { settings: boolean; usage: boolean }; warnings: string[]; items: unknown[] };
    expect(response.status).toBe(200);
    expect(body.availability).toEqual({ settings: true, usage: false });
    expect(body.items).toHaveLength(2);
    expect(body.warnings.join(" ")).not.toContain("D1_ERROR");
  });

  it("suggestion sorgusu hata verse de 200 ve güvenli fallback döndürür", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    routeState.db = fakeDb({ failOn: "FROM ai_social_settings" }).db;
    const response = await getTodayRoute(await authenticatedRequest("/api/social/ai/today"));
    const body = await response.json() as { available: boolean; warnings: string[]; items: unknown[] };
    expect(response.status).toBe(200);
    expect(body.available).toBe(false);
    expect(body.items).toHaveLength(2);
    expect(body.warnings).toContain("İçerik geçmişi şu anda yüklenemedi. İçerik üretmeye devam edebilirsiniz.");
    expect(JSON.stringify(body)).not.toContain("D1_ERROR");
  });

  it("regional ideas timeout olduğunda sayfayı düşürmeden boş state döndürür", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    routeState.db = fakeDb({ failOn: "FROM regional_content_ideas ORDER BY" }).db;
    const response = await getResearchRoute(await authenticatedRequest("/api/social/ai/research"));
    const body = await response.json() as { available: boolean; warnings: string[]; items: unknown[] };
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ available: false, items: [] });
    expect(body.warnings.join(" ")).toContain("İçerik üretmeye devam edebilirsiniz");
    expect(JSON.stringify(body)).not.toContain("D1_ERROR");
  });
});
