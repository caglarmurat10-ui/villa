CREATE TABLE IF NOT EXISTS villa_ai_profiles (
  villa TEXT PRIMARY KEY CHECK (villa IN ('Safira', 'Destan')),
  facts_json TEXT NOT NULL DEFAULT '[]',
  prohibited_claims_json TEXT NOT NULL DEFAULT '[]',
  tone TEXT NOT NULL DEFAULT 'warm',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_social_settings (
  villa TEXT PRIMARY KEY CHECK (villa IN ('Safira', 'Destan')),
  ai_enabled INTEGER NOT NULL DEFAULT 0 CHECK (ai_enabled IN (0, 1)),
  daily_text_limit INTEGER NOT NULL DEFAULT 5 CHECK (daily_text_limit BETWEEN 0 AND 100),
  daily_research_limit INTEGER NOT NULL DEFAULT 2 CHECK (daily_research_limit BETWEEN 0 AND 50),
  image_enabled INTEGER NOT NULL DEFAULT 0 CHECK (image_enabled IN (0, 1)),
  video_enabled INTEGER NOT NULL DEFAULT 0 CHECK (video_enabled IN (0, 1)),
  autopilot_level TEXT NOT NULL DEFAULT 'off'
    CHECK (autopilot_level IN ('off', 'suggestion', 'draft', 'auto_schedule')),
  content_mix_json TEXT NOT NULL DEFAULT '{"villa":35,"regional":25,"travel":15,"availability":15,"special":10}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS regional_content_ideas (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content_angle TEXT NOT NULL,
  source_urls_json TEXT NOT NULL DEFAULT '[]',
  source_titles_json TEXT NOT NULL DEFAULT '[]',
  content_ideas_json TEXT NOT NULL DEFAULT '[]',
  event_date TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'approved', 'scheduled', 'used', 'ignored', 'expired')),
  relevance_score INTEGER NOT NULL DEFAULT 0 CHECK (relevance_score BETWEEN 0 AND 100),
  freshness_score INTEGER NOT NULL DEFAULT 0 CHECK (freshness_score BETWEEN 0 AND 100),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS regional_content_topic_idx
ON regional_content_ideas (region, topic, status, expires_at DESC);

CREATE TABLE IF NOT EXISTS ai_content_history (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  content_type TEXT NOT NULL,
  topic TEXT NOT NULL,
  template_style TEXT NOT NULL,
  caption_hash TEXT NOT NULL,
  media_category TEXT,
  output_json TEXT NOT NULL,
  source_urls_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  published_at TEXT,
  performance_summary TEXT
);

CREATE INDEX IF NOT EXISTS ai_content_history_recent_idx
ON ai_content_history (villa, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_weekly_plans (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  week_start TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'scheduled', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (villa, week_start)
);

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  operation TEXT NOT NULL,
  model TEXT NOT NULL,
  villa TEXT,
  daily_key TEXT NOT NULL,
  estimated_units INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 0 CHECK (success IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_usage_daily_idx
ON ai_usage_log (daily_key, service, operation, villa);

CREATE TABLE IF NOT EXISTS ai_service_state (
  service TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0,
  open_until TEXT,
  last_failure_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_media_provenance (
  media_id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('owner', 'Pexels', 'OpenAI')),
  photographer TEXT,
  photographer_url TEXT,
  source_url TEXT,
  source_id TEXT,
  search_query TEXT,
  license_source TEXT,
  ai_generated INTEGER NOT NULL DEFAULT 0 CHECK (ai_generated IN (0, 1)),
  geographic_claim TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS social_media_provenance_source_idx
ON social_media_provenance (source, source_id);
