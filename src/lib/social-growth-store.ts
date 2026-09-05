import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "./types";

export type ProspectCategory =
  | "travel_creator" | "local_creator" | "tourism_page" | "local_business"
  | "photographer" | "food_creator" | "family_travel" | "lifestyle_creator" | "high_value_guest_source";

export type ProspectStatus = "DISCOVERED" | "WATCHLIST" | "RECOMMENDED" | "FOLLOWED_MANUALLY" | "DISMISSED" | "BLOCKED";
export type ProspectSourceType = "manual_entry" | "public_web_search" | "manual_seed_review";

export type SocialProspect = {
  id: string;
  villa: Villa | null;
  platform: string;
  username: string;
  accountId: string | null;
  displayName: string | null;
  profileUrl: string | null;
  category: ProspectCategory;
  bioSummary: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  locationHint: string | null;
  relevanceScore: number | null;
  engagementScore: number | null;
  locationScore: number | null;
  audienceFitScore: number | null;
  spamRiskScore: number | null;
  finalGrowthScore: number | null;
  discoveredAt: string;
  lastCheckedAt: string | null;
  status: ProspectStatus;
  sourceType: ProspectSourceType | null;
  sourceUrl: string | null;
  shortReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EngagementRisk = "AUTO_SAFE" | "REVIEW_REQUIRED" | "BLOCKED";
export type OpportunityStatus = "DISCOVERED" | "RECOMMENDED" | "DISMISSED" | "USED";

export type SocialEngagementOpportunity = {
  id: string;
  villa: Villa | null;
  prospectId: string | null;
  targetUsername: string;
  mediaLink: string | null;
  context: string | null;
  suggestedComment: string | null;
  riskClassification: EngagementRisk;
  status: OpportunityStatus;
  createdAt: string;
  updatedAt: string;
};

export type AgentType = "SCOUT" | "INSIGHTS" | "COMMENTS" | "MENTIONS" | "DM" | "PROSPECT_REFRESH";
export type AgentRunStatus = "OK" | "ERROR" | "PENDING_PERMISSION" | "PENDING_CONFIGURATION";

export type SocialAgentRun = {
  id: string;
  agentType: AgentType;
  startedAt: string;
  finishedAt: string | null;
  status: AgentRunStatus;
  candidateCount: number;
  requiredPermission: string | null;
  notes: string | null;
};

type ProspectRow = {
  id: string; villa: Villa | null; platform: string; username: string; account_id: string | null;
  display_name: string | null; profile_url: string | null; category: ProspectCategory; bio_summary: string | null;
  followers_count: number | null; media_count: number | null; location_hint: string | null;
  relevance_score: number | null; engagement_score: number | null; location_score: number | null;
  audience_fit_score: number | null; spam_risk_score: number | null; final_growth_score: number | null;
  discovered_at: string; last_checked_at: string | null; status: ProspectStatus;
  source_type: ProspectSourceType | null; source_url: string | null; short_reason: string | null;
  created_at: string; updated_at: string;
};

type OpportunityRow = {
  id: string; villa: Villa | null; prospect_id: string | null; target_username: string;
  media_link: string | null; context: string | null; suggested_comment: string | null;
  risk_classification: EngagementRisk; status: OpportunityStatus; created_at: string; updated_at: string;
};

type AgentRunRow = {
  id: string; agent_type: AgentType; started_at: string; finished_at: string | null;
  status: AgentRunStatus; candidate_count: number; required_permission: string | null; notes: string | null;
};

let tablesReady: Promise<void> | null = null;

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

async function prepareTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS social_prospects (
      id TEXT PRIMARY KEY,
      villa TEXT CHECK (villa IN ('Safira','Destan')),
      platform TEXT NOT NULL DEFAULT 'Instagram',
      username TEXT NOT NULL,
      account_id TEXT,
      display_name TEXT,
      profile_url TEXT,
      category TEXT NOT NULL DEFAULT 'travel_creator' CHECK (category IN (
        'travel_creator','local_creator','tourism_page','local_business',
        'photographer','food_creator','family_travel','lifestyle_creator','high_value_guest_source'
      )),
      bio_summary TEXT,
      followers_count INTEGER,
      media_count INTEGER,
      location_hint TEXT,
      relevance_score INTEGER,
      engagement_score INTEGER,
      location_score INTEGER,
      audience_fit_score INTEGER,
      spam_risk_score INTEGER,
      final_growth_score INTEGER,
      discovered_at TEXT NOT NULL,
      last_checked_at TEXT,
      status TEXT NOT NULL DEFAULT 'DISCOVERED' CHECK (status IN ('DISCOVERED','WATCHLIST','RECOMMENDED','FOLLOWED_MANUALLY','DISMISSED','BLOCKED')),
      source_type TEXT CHECK (source_type IN ('manual_entry','public_web_search','manual_seed_review')),
      source_url TEXT,
      short_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (platform, username)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS social_prospects_status_idx ON social_prospects (status, villa)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS social_prospect_media (
      id TEXT PRIMARY KEY,
      prospect_id TEXT NOT NULL,
      media_id TEXT,
      media_type TEXT,
      caption_summary TEXT,
      permalink TEXT,
      discovered_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS social_prospect_media_prospect_idx ON social_prospect_media (prospect_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS social_engagement_opportunities (
      id TEXT PRIMARY KEY,
      villa TEXT CHECK (villa IN ('Safira','Destan')),
      prospect_id TEXT,
      target_username TEXT NOT NULL,
      media_link TEXT,
      context TEXT,
      suggested_comment TEXT,
      risk_classification TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED' CHECK (risk_classification IN ('AUTO_SAFE','REVIEW_REQUIRED','BLOCKED')),
      status TEXT NOT NULL DEFAULT 'DISCOVERED' CHECK (status IN ('DISCOVERED','RECOMMENDED','DISMISSED','USED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS social_engagement_opportunities_status_idx ON social_engagement_opportunities (status, villa)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS social_agent_runs (
      id TEXT PRIMARY KEY,
      agent_type TEXT NOT NULL CHECK (agent_type IN ('SCOUT','INSIGHTS','COMMENTS','MENTIONS','DM','PROSPECT_REFRESH')),
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_PERMISSION' CHECK (status IN ('OK','ERROR','PENDING_PERMISSION','PENDING_CONFIGURATION')),
      candidate_count INTEGER NOT NULL DEFAULT 0,
      required_permission TEXT,
      notes TEXT
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS social_agent_runs_type_idx ON social_agent_runs (agent_type, started_at)"),
  ]);
}

async function ensureTables(db: D1Database) {
  if (!tablesReady) {
    tablesReady = prepareTables(db).catch((error) => {
      tablesReady = null;
      throw error;
    });
  }
  await tablesReady;
}

function mapProspect(row: ProspectRow): SocialProspect {
  return {
    id: row.id, villa: row.villa, platform: row.platform, username: row.username, accountId: row.account_id,
    displayName: row.display_name, profileUrl: row.profile_url, category: row.category, bioSummary: row.bio_summary,
    followersCount: row.followers_count, mediaCount: row.media_count, locationHint: row.location_hint,
    relevanceScore: row.relevance_score, engagementScore: row.engagement_score, locationScore: row.location_score,
    audienceFitScore: row.audience_fit_score, spamRiskScore: row.spam_risk_score, finalGrowthScore: row.final_growth_score,
    discoveredAt: row.discovered_at, lastCheckedAt: row.last_checked_at, status: row.status,
    sourceType: row.source_type, sourceUrl: row.source_url, shortReason: row.short_reason,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapOpportunity(row: OpportunityRow): SocialEngagementOpportunity {
  return {
    id: row.id, villa: row.villa, prospectId: row.prospect_id, targetUsername: row.target_username,
    mediaLink: row.media_link, context: row.context, suggestedComment: row.suggested_comment,
    riskClassification: row.risk_classification, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function mapAgentRun(row: AgentRunRow): SocialAgentRun {
  return {
    id: row.id, agentType: row.agent_type, startedAt: row.started_at, finishedAt: row.finished_at,
    status: row.status, candidateCount: Number(row.candidate_count ?? 0),
    requiredPermission: row.required_permission, notes: row.notes,
  };
}

export type ListProspectsOptions = {
  villa?: Villa | null;
  statuses?: ProspectStatus[];
  discoveredOn?: string; // 'YYYY-MM-DD' (Europe/Istanbul), filtreler discovered_at
  limit?: number;
};

export async function listProspects(options: ListProspectsOptions = {}): Promise<SocialProspect[]> {
  const db = await database();
  await ensureTables(db);
  const safeLimit = Math.max(1, Math.min(200, options.limit ?? 50));
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (options.villa) { conditions.push("villa = ?"); params.push(options.villa); }
  if (options.statuses?.length) { conditions.push(`status IN (${options.statuses.map(() => "?").join(",")})`); params.push(...options.statuses); }
  if (options.discoveredOn) { conditions.push("discovered_at LIKE ?"); params.push(`${options.discoveredOn}%`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(safeLimit);
  const result = await db.prepare(
    `SELECT * FROM social_prospects ${where} ORDER BY final_growth_score DESC, discovered_at DESC LIMIT ?`,
  ).bind(...params).all<ProspectRow>();
  return result.results.map(mapProspect);
}

export type NewProspectInput = Omit<SocialProspect, "id" | "createdAt" | "updatedAt" | "status"> & { status?: ProspectStatus };

// Otomatik (public scout) kaynaklı adaylar için: aynı platform+username tekrar bulunursa
// SESSİZCE günceller (skor/son görülme tazelenir) - bu, "aynı hesabı tekrar tekrar önerme"
// kuralının veri katmanındaki garantisidir (UNIQUE(platform, username) + ON CONFLICT).
export async function upsertProspect(input: NewProspectInput): Promise<SocialProspect> {
  const db = await database();
  await ensureTables(db);
  const now = new Date().toISOString();
  const existing = await db.prepare("SELECT id FROM social_prospects WHERE platform = ? AND username = ?")
    .bind(input.platform, input.username).first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  await db.prepare(`INSERT INTO social_prospects
    (id, villa, platform, username, account_id, display_name, profile_url, category, bio_summary, followers_count, media_count,
     location_hint, relevance_score, engagement_score, location_score, audience_fit_score, spam_risk_score,
     final_growth_score, discovered_at, last_checked_at, status, source_type, source_url, short_reason, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform, username) DO UPDATE SET
      villa=excluded.villa, account_id=excluded.account_id, display_name=excluded.display_name, profile_url=excluded.profile_url,
      category=excluded.category, bio_summary=excluded.bio_summary, followers_count=excluded.followers_count,
      media_count=excluded.media_count, location_hint=excluded.location_hint, relevance_score=excluded.relevance_score,
      engagement_score=excluded.engagement_score, location_score=excluded.location_score,
      audience_fit_score=excluded.audience_fit_score, spam_risk_score=excluded.spam_risk_score,
      final_growth_score=excluded.final_growth_score, last_checked_at=excluded.last_checked_at,
      source_type=excluded.source_type, source_url=excluded.source_url, short_reason=excluded.short_reason,
      updated_at=excluded.updated_at`)
    .bind(
      id, input.villa, input.platform, input.username, input.accountId, input.displayName, input.profileUrl, input.category,
      input.bioSummary, input.followersCount, input.mediaCount, input.locationHint, input.relevanceScore,
      input.engagementScore, input.locationScore, input.audienceFitScore, input.spamRiskScore, input.finalGrowthScore,
      input.discoveredAt, input.lastCheckedAt, input.status ?? "DISCOVERED",
      input.sourceType ?? null, input.sourceUrl ?? null, input.shortReason ?? null, now, now,
    ).run();
  const row = await db.prepare("SELECT * FROM social_prospects WHERE id = ?").bind(id).first<ProspectRow>();
  return mapProspect(row!);
}

export type CreateManualProspectResult = { ok: true; prospect: SocialProspect } | { ok: false; error: string };

// Manuel "Yeni Hesap Ekle" formu için - otomatik scout'un aksine burada duplicate SESSİZCE
// güncellenmez, açıkça REDDEDİLİR ("Duplicate username/platform engeli olsun" talebi).
export async function createManualProspect(input: NewProspectInput): Promise<CreateManualProspectResult> {
  const db = await database();
  await ensureTables(db);
  const existing = await db.prepare("SELECT id FROM social_prospects WHERE platform = ? AND username = ?")
    .bind(input.platform, input.username).first<{ id: string }>();
  if (existing) return { ok: false, error: `@${input.username} (${input.platform}) zaten ekli.` };

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO social_prospects
    (id, villa, platform, username, account_id, display_name, profile_url, category, bio_summary, followers_count, media_count,
     location_hint, relevance_score, engagement_score, location_score, audience_fit_score, spam_risk_score,
     final_growth_score, discovered_at, last_checked_at, status, source_type, source_url, short_reason, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISCOVERED', 'manual_entry', ?, ?, ?, ?)`)
    .bind(
      id, input.villa, input.platform, input.username, input.accountId, input.displayName, input.profileUrl, input.category,
      input.bioSummary, input.followersCount, input.mediaCount, input.locationHint, input.relevanceScore,
      input.engagementScore, input.locationScore, input.audienceFitScore, input.spamRiskScore, input.finalGrowthScore,
      input.discoveredAt, input.lastCheckedAt, input.sourceUrl ?? null, input.shortReason ?? null, now, now,
    ).run();
  const row = await db.prepare("SELECT * FROM social_prospects WHERE id = ?").bind(id).first<ProspectRow>();
  return { ok: true, prospect: mapProspect(row!) };
}

export async function updateProspectStatus(id: string, status: ProspectStatus): Promise<SocialProspect | null> {
  const db = await database();
  await ensureTables(db);
  const now = new Date().toISOString();
  await db.prepare("UPDATE social_prospects SET status = ?, updated_at = ? WHERE id = ?").bind(status, now, id).run();
  const row = await db.prepare("SELECT * FROM social_prospects WHERE id = ?").bind(id).first<ProspectRow>();
  return row ? mapProspect(row) : null;
}

export async function getProspect(id: string): Promise<SocialProspect | null> {
  const db = await database();
  await ensureTables(db);
  const row = await db.prepare("SELECT * FROM social_prospects WHERE id = ?").bind(id).first<ProspectRow>();
  return row ? mapProspect(row) : null;
}

export async function listOpportunities(villa?: Villa | null, limit = 50): Promise<SocialEngagementOpportunity[]> {
  const db = await database();
  await ensureTables(db);
  const safeLimit = Math.max(1, Math.min(200, limit));
  const sql = villa
    ? `SELECT * FROM social_engagement_opportunities WHERE villa = ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM social_engagement_opportunities ORDER BY created_at DESC LIMIT ?`;
  const statement = villa ? db.prepare(sql).bind(villa, safeLimit) : db.prepare(sql).bind(safeLimit);
  const result = await statement.all<OpportunityRow>();
  return result.results.map(mapOpportunity);
}

export async function createOpportunity(input: {
  villa: Villa | null; prospectId: string | null; targetUsername: string; mediaLink: string | null;
  context: string | null; suggestedComment: string; riskClassification: EngagementRisk;
}): Promise<SocialEngagementOpportunity> {
  const db = await database();
  await ensureTables(db);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO social_engagement_opportunities
    (id, villa, prospect_id, target_username, media_link, context, suggested_comment, risk_classification, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RECOMMENDED', ?, ?)`)
    .bind(id, input.villa, input.prospectId, input.targetUsername, input.mediaLink, input.context, input.suggestedComment, input.riskClassification, now, now)
    .run();
  return {
    id, villa: input.villa, prospectId: input.prospectId, targetUsername: input.targetUsername, mediaLink: input.mediaLink,
    context: input.context, suggestedComment: input.suggestedComment, riskClassification: input.riskClassification,
    status: "RECOMMENDED", createdAt: now, updatedAt: now,
  };
}

export async function listAgentRuns(limit = 30): Promise<SocialAgentRun[]> {
  const db = await database();
  await ensureTables(db);
  const safeLimit = Math.max(1, Math.min(100, limit));
  const result = await db.prepare("SELECT * FROM social_agent_runs ORDER BY started_at DESC LIMIT ?").bind(safeLimit).all<AgentRunRow>();
  return result.results.map(mapAgentRun);
}

export async function recordAgentRun(input: {
  agentType: AgentType; status: AgentRunStatus; candidateCount?: number; requiredPermission?: string | null; notes?: string | null;
}): Promise<SocialAgentRun> {
  const db = await database();
  await ensureTables(db);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO social_agent_runs
    (id, agent_type, started_at, finished_at, status, candidate_count, required_permission, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, input.agentType, now, now, input.status, input.candidateCount ?? 0, input.requiredPermission ?? null, input.notes ?? null)
    .run();
  return {
    id, agentType: input.agentType, startedAt: now, finishedAt: now, status: input.status,
    candidateCount: input.candidateCount ?? 0, requiredPermission: input.requiredPermission ?? null, notes: input.notes ?? null,
  };
}
