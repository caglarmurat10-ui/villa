import type { D1Database } from "@cloudflare/workers-types";
import type { AiContentOutput, RegionalResearchOutput, VillaAiProfile } from "./aiTypes";
import { hashCaption } from "./social-rules";
import type { Villa } from "./types";

export type AiSocialSettings = {
  villa: Villa;
  aiEnabled: boolean;
  dailyTextLimit: number;
  dailyResearchLimit: number;
  imageEnabled: boolean;
  videoEnabled: boolean;
  autopilotLevel: "off" | "suggestion" | "draft" | "auto_schedule";
  contentMix: { villa: number; regional: number; travel: number; availability: number; special: number };
};

type SettingsRow = { villa: Villa; ai_enabled: number; daily_text_limit: number; daily_research_limit: number;
  image_enabled: number; video_enabled: number; autopilot_level: AiSocialSettings["autopilotLevel"]; content_mix_json: string };
type ProfileRow = { villa: Villa; facts_json: string; prohibited_claims_json: string; tone: string };

export const DEFAULT_AI_SETTINGS: Omit<AiSocialSettings, "villa"> = {
  aiEnabled: false,
  dailyTextLimit: 5,
  dailyResearchLimit: 2,
  imageEnabled: false,
  videoEnabled: false,
  autopilotLevel: "off",
  contentMix: { villa: 35, regional: 25, travel: 15, availability: 15, special: 10 },
};

function stringArray(value: string) {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : []; }
  catch { return []; }
}

function objectJson<T>(value: string, fallback: T): T {
  try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : fallback; }
  catch { return fallback; }
}

export async function ensureAiTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS villa_ai_profiles (villa TEXT PRIMARY KEY,facts_json TEXT NOT NULL DEFAULT '[]',
      prohibited_claims_json TEXT NOT NULL DEFAULT '[]',tone TEXT NOT NULL DEFAULT 'warm',updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ai_social_settings (villa TEXT PRIMARY KEY,ai_enabled INTEGER NOT NULL DEFAULT 0,
      daily_text_limit INTEGER NOT NULL DEFAULT 5,daily_research_limit INTEGER NOT NULL DEFAULT 2,image_enabled INTEGER NOT NULL DEFAULT 0,
      video_enabled INTEGER NOT NULL DEFAULT 0,autopilot_level TEXT NOT NULL DEFAULT 'off',content_mix_json TEXT NOT NULL,updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS regional_content_ideas (id TEXT PRIMARY KEY,region TEXT NOT NULL,topic TEXT NOT NULL,
      title TEXT NOT NULL,summary TEXT NOT NULL,content_angle TEXT NOT NULL,source_urls_json TEXT NOT NULL DEFAULT '[]',
      source_titles_json TEXT NOT NULL DEFAULT '[]',content_ideas_json TEXT NOT NULL DEFAULT '[]',event_date TEXT,status TEXT NOT NULL DEFAULT 'new',
      relevance_score INTEGER NOT NULL DEFAULT 0,freshness_score INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,used_at TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS regional_content_topic_idx ON regional_content_ideas(region,topic,status,expires_at DESC)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ai_content_history (id TEXT PRIMARY KEY,villa TEXT NOT NULL,content_type TEXT NOT NULL,
      topic TEXT NOT NULL,template_style TEXT NOT NULL,caption_hash TEXT NOT NULL,media_category TEXT,output_json TEXT NOT NULL,
      source_urls_json TEXT NOT NULL DEFAULT '[]',status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL,published_at TEXT,performance_summary TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS ai_content_history_recent_idx ON ai_content_history(villa,created_at DESC)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ai_weekly_plans (id TEXT PRIMARY KEY,villa TEXT NOT NULL,week_start TEXT NOT NULL,
      plan_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(villa,week_start))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ai_usage_log (id TEXT PRIMARY KEY,service TEXT NOT NULL,operation TEXT NOT NULL,
      model TEXT NOT NULL,villa TEXT,daily_key TEXT NOT NULL,estimated_units INTEGER NOT NULL DEFAULT 0,success INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS ai_usage_daily_idx ON ai_usage_log(daily_key,service,operation,villa)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ai_service_state (service TEXT PRIMARY KEY,failure_count INTEGER NOT NULL DEFAULT 0,
      open_until TEXT,last_failure_at TEXT,updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS social_media_provenance (media_id TEXT PRIMARY KEY,source TEXT NOT NULL,
      photographer TEXT,photographer_url TEXT,source_url TEXT,source_id TEXT,search_query TEXT,license_source TEXT,
      ai_generated INTEGER NOT NULL DEFAULT 0,geographic_claim TEXT,created_at TEXT NOT NULL)`),
  ]);
}

export function dailyKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now);
}

export async function getAiSettings(db: D1Database, villa: Villa): Promise<AiSocialSettings> {
  await ensureAiTables(db);
  const row = await db.prepare("SELECT * FROM ai_social_settings WHERE villa=?").bind(villa).first<SettingsRow>();
  if (!row) return { villa, ...DEFAULT_AI_SETTINGS };
  return { villa, aiEnabled: row.ai_enabled === 1, dailyTextLimit: row.daily_text_limit,
    dailyResearchLimit: row.daily_research_limit, imageEnabled: row.image_enabled === 1,
    videoEnabled: row.video_enabled === 1, autopilotLevel: row.autopilot_level,
    contentMix: objectJson(row.content_mix_json, DEFAULT_AI_SETTINGS.contentMix) };
}

export async function saveAiSettings(db: D1Database, input: AiSocialSettings) {
  const total = Object.values(input.contentMix).reduce((sum, value) => sum + value, 0);
  if (total !== 100) throw new Error("AI içerik dağılımı toplamı %100 olmalı.");
  if (input.dailyTextLimit < 0 || input.dailyTextLimit > 100 || input.dailyResearchLimit < 0 || input.dailyResearchLimit > 50) {
    throw new Error("AI günlük limitleri geçersiz.");
  }
  await ensureAiTables(db);
  await db.prepare(`INSERT INTO ai_social_settings
    (villa,ai_enabled,daily_text_limit,daily_research_limit,image_enabled,video_enabled,autopilot_level,content_mix_json,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(villa) DO UPDATE SET ai_enabled=excluded.ai_enabled,
      daily_text_limit=excluded.daily_text_limit,daily_research_limit=excluded.daily_research_limit,image_enabled=excluded.image_enabled,
      video_enabled=excluded.video_enabled,autopilot_level=excluded.autopilot_level,content_mix_json=excluded.content_mix_json,updated_at=excluded.updated_at`)
    .bind(input.villa, Number(input.aiEnabled), input.dailyTextLimit, input.dailyResearchLimit, Number(input.imageEnabled),
      Number(input.videoEnabled), input.autopilotLevel, JSON.stringify(input.contentMix), new Date().toISOString()).run();
  return input;
}

export async function getVillaAiProfile(db: D1Database, villa: Villa): Promise<VillaAiProfile> {
  await ensureAiTables(db);
  const row = await db.prepare("SELECT * FROM villa_ai_profiles WHERE villa=?").bind(villa).first<ProfileRow>();
  return row ? { villa, facts: stringArray(row.facts_json), prohibitedClaims: stringArray(row.prohibited_claims_json), tone: row.tone }
    : { villa, facts: ["Patara / Kaş bölgesinde konaklama"], prohibitedClaims: [], tone: "warm" };
}

export async function saveVillaAiProfile(db: D1Database, input: VillaAiProfile) {
  await ensureAiTables(db);
  const facts = [...new Set(input.facts.map((item) => item.trim()).filter(Boolean))].slice(0, 50);
  const prohibited = [...new Set(input.prohibitedClaims.map((item) => item.trim()).filter(Boolean))].slice(0, 50);
  await db.prepare(`INSERT INTO villa_ai_profiles(villa,facts_json,prohibited_claims_json,tone,updated_at)
    VALUES (?,?,?,?,?) ON CONFLICT(villa) DO UPDATE SET facts_json=excluded.facts_json,
      prohibited_claims_json=excluded.prohibited_claims_json,tone=excluded.tone,updated_at=excluded.updated_at`)
    .bind(input.villa, JSON.stringify(facts), JSON.stringify(prohibited), input.tone.slice(0, 40), new Date().toISOString()).run();
  return { ...input, facts, prohibitedClaims: prohibited };
}

export async function assertAiBudget(db: D1Database, villa: Villa, operation: "text" | "research" | "image", now = new Date()) {
  const settings = await getAiSettings(db, villa);
  if (!settings.aiEnabled) throw new Error("AI bu villa için kapalı.");
  const service = operation === "research" ? "openai-web" : operation === "image" ? "openai-image" : "openai-text";
  const row = await db.prepare("SELECT COUNT(*) AS count FROM ai_usage_log WHERE daily_key=? AND villa=? AND service=?")
    .bind(dailyKey(now), villa, service).first<{ count: number }>();
  const limit = operation === "research" ? settings.dailyResearchLimit : settings.dailyTextLimit;
  if ((row?.count ?? 0) >= limit) throw new Error("Günlük AI kullanım limiti doldu.");
  return { settings, used: row?.count ?? 0, limit };
}

export async function logAiUsage(db: D1Database, input: { service: string; operation: string; model: string; villa: Villa | null; estimatedUnits: number; success: boolean }, now = new Date()) {
  await ensureAiTables(db);
  await db.prepare(`INSERT INTO ai_usage_log(id,service,operation,model,villa,daily_key,estimated_units,success,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), input.service, input.operation, input.model, input.villa,
      dailyKey(now), Math.max(0, Math.round(input.estimatedUnits)), Number(input.success), now.toISOString()).run();
}

export async function aiCircuitOpen(db: D1Database, service: string, now = new Date()) {
  await ensureAiTables(db);
  const row = await db.prepare("SELECT open_until FROM ai_service_state WHERE service=?").bind(service).first<{ open_until: string | null }>();
  return Boolean(row?.open_until && Date.parse(row.open_until) > now.getTime());
}

export async function recordAiServiceResult(db: D1Database, service: string, success: boolean, now = new Date()) {
  await ensureAiTables(db);
  if (success) {
    await db.prepare(`INSERT INTO ai_service_state(service,failure_count,open_until,last_failure_at,updated_at)
      VALUES (?,0,NULL,NULL,?) ON CONFLICT(service) DO UPDATE SET failure_count=0,open_until=NULL,updated_at=excluded.updated_at`)
      .bind(service, now.toISOString()).run();
    return;
  }
  const current = await db.prepare("SELECT failure_count FROM ai_service_state WHERE service=?").bind(service).first<{ failure_count: number }>();
  const failures = (current?.failure_count ?? 0) + 1;
  const openUntil = failures >= 3 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;
  await db.prepare(`INSERT INTO ai_service_state(service,failure_count,open_until,last_failure_at,updated_at)
    VALUES (?,?,?,?,?) ON CONFLICT(service) DO UPDATE SET failure_count=excluded.failure_count,
      open_until=excluded.open_until,last_failure_at=excluded.last_failure_at,updated_at=excluded.updated_at`)
    .bind(service, failures, openUntil, now.toISOString(), now.toISOString()).run();
}

export async function saveAiHistory(db: D1Database, input: { villa: Villa; purpose: string; mode: string; mediaCategory: string | null; output: AiContentOutput; sourceUrls?: string[] }) {
  await ensureAiTables(db);
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO ai_content_history
    (id,villa,content_type,topic,template_style,caption_hash,media_category,output_json,source_urls_json,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,'draft',?)`).bind(id, input.villa, input.output.contentType,
      input.output.regionalTopic ?? input.purpose, input.mode, hashCaption(input.output.caption), input.mediaCategory,
      JSON.stringify(input.output), JSON.stringify(input.sourceUrls ?? []), new Date().toISOString()).run();
  return id;
}

export async function recentAiContext(db: D1Database, villa: Villa) {
  await ensureAiTables(db);
  const history = await db.prepare(`SELECT content_type,topic,template_style,caption_hash,media_category,output_json,
    performance_summary,created_at FROM ai_content_history WHERE villa=? ORDER BY created_at DESC LIMIT 20`)
    .bind(villa).all<Record<string, unknown>>();
  const performance = await db.prepare(`SELECT media_type,metrics_json FROM instagram_media_insights WHERE villa=?
    AND published_at>=? ORDER BY published_at DESC LIMIT 30`).bind(villa, new Date(Date.now() - 30 * 86_400_000).toISOString())
    .all<Record<string, unknown>>();
  return { history: history.results, aggregatePerformance: performance.results };
}

export async function cachedRegionalIdea(db: D1Database, region: string, topic: string, now = new Date()) {
  await ensureAiTables(db);
  return db.prepare(`SELECT * FROM regional_content_ideas WHERE region=? AND topic=? AND status NOT IN ('ignored','expired')
    AND expires_at>? ORDER BY created_at DESC LIMIT 1`).bind(region, topic, now.toISOString()).first<Record<string, unknown>>();
}

export async function saveRegionalIdea(db: D1Database, result: RegionalResearchOutput, region: string) {
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  await db.prepare(`INSERT INTO regional_content_ideas
    (id,region,topic,title,summary,content_angle,source_urls_json,source_titles_json,content_ideas_json,event_date,
     status,relevance_score,freshness_score,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,'new',?,?,?,?)`)
    .bind(id, region, result.topic, result.topic, result.summary, result.whyInteresting, JSON.stringify(result.sourceUrls),
      JSON.stringify(result.sourceTitles), JSON.stringify(result.contentIdeas), result.eventDate, result.relevanceScore,
      result.freshnessScore, now, result.expiresAt).run();
  return id;
}

export async function listRegionalIdeas(db: D1Database) {
  await ensureAiTables(db);
  const result = await db.prepare("SELECT * FROM regional_content_ideas ORDER BY created_at DESC LIMIT 100").all<Record<string, unknown>>();
  return result.results.map((row) => ({ ...row,
    sourceUrls: typeof row.source_urls_json === "string" ? stringArray(row.source_urls_json) : [],
    sourceTitles: typeof row.source_titles_json === "string" ? stringArray(row.source_titles_json) : [],
    contentIdeas: typeof row.content_ideas_json === "string" ? stringArray(row.content_ideas_json) : [],
  }));
}

export async function saveWeeklyPlan(db: D1Database, villa: Villa, weekStart: string, output: AiContentOutput) {
  await ensureAiTables(db); const now = new Date().toISOString(); const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO ai_weekly_plans(id,villa,week_start,plan_json,status,created_at,updated_at)
    VALUES (?,?,?,?,'draft',?,?) ON CONFLICT(villa,week_start) DO UPDATE SET plan_json=excluded.plan_json,
      status='draft',updated_at=excluded.updated_at`).bind(id, villa, weekStart, JSON.stringify(output.weeklyPlan), now, now).run();
}

export async function aiUsageSummary(db: D1Database, now = new Date()) {
  await ensureAiTables(db); const month = dailyKey(now).slice(0, 7);
  const result = await db.prepare(`SELECT service,operation,model,villa,COUNT(*) AS calls,SUM(estimated_units) AS estimated_units
    FROM ai_usage_log WHERE daily_key LIKE ? GROUP BY service,operation,model,villa ORDER BY calls DESC`).bind(`${month}%`).all();
  return result.results;
}

export async function saveMediaProvenance(db: D1Database, input: { mediaId: string; source: "owner" | "Pexels" | "OpenAI";
  photographer?: string | null; photographerUrl?: string | null; sourceUrl?: string | null; sourceId?: string | null;
  searchQuery?: string | null; licenseSource?: string | null; aiGenerated?: boolean; geographicClaim?: string | null }) {
  await ensureAiTables(db);
  await db.prepare(`INSERT INTO social_media_provenance
    (media_id,source,photographer,photographer_url,source_url,source_id,search_query,license_source,ai_generated,geographic_claim,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(media_id) DO UPDATE SET source=excluded.source,photographer=excluded.photographer,
      photographer_url=excluded.photographer_url,source_url=excluded.source_url,source_id=excluded.source_id,
      search_query=excluded.search_query,license_source=excluded.license_source,ai_generated=excluded.ai_generated,
      geographic_claim=excluded.geographic_claim`).bind(input.mediaId, input.source, input.photographer ?? null,
      input.photographerUrl ?? null, input.sourceUrl ?? null, input.sourceId ?? null, input.searchQuery ?? null,
      input.licenseSource ?? null, Number(input.aiGenerated ?? false), input.geographicClaim ?? null, new Date().toISOString()).run();
}
