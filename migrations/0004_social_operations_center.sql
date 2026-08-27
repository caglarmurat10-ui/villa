CREATE TABLE IF NOT EXISTS social_campaign_drafts (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  campaign_type TEXT NOT NULL,
  availability_start TEXT,
  availability_end TEXT,
  nights INTEGER,
  media_ids_json TEXT NOT NULL DEFAULT '[]',
  caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 2200),
  caption_hash TEXT,
  template_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'ignored', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'availability', 'automation')),
  content_category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  scheduled_post_id TEXT,
  ignored_at TEXT
);

CREATE INDEX IF NOT EXISTS social_campaign_window_idx
ON social_campaign_drafts (villa, availability_start, availability_end, status);

CREATE INDEX IF NOT EXISTS social_campaign_schedule_idx
ON social_campaign_drafts (scheduled_post_id);

CREATE INDEX IF NOT EXISTS social_campaign_hash_idx
ON social_campaign_drafts (caption_hash, created_at);

CREATE TABLE IF NOT EXISTS social_media_library (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  media_type TEXT NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO')),
  kv_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT,
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1))
);

CREATE INDEX IF NOT EXISTS social_media_library_pick_idx
ON social_media_library (villa, active, media_type, use_count, last_used_at);

CREATE TABLE IF NOT EXISTS social_villa_settings (
  villa TEXT PRIMARY KEY CHECK (villa IN ('Safira', 'Destan')),
  pilot_enabled INTEGER NOT NULL DEFAULT 0 CHECK (pilot_enabled IN (0, 1)),
  weekly_target INTEGER NOT NULL DEFAULT 3 CHECK (weekly_target BETWEEN 1 AND 7),
  preferred_times_json TEXT NOT NULL DEFAULT '["11:30","19:30","21:00"]',
  include_price INTEGER NOT NULL DEFAULT 0 CHECK (include_price IN (0, 1)),
  min_gap_nights INTEGER NOT NULL DEFAULT 1 CHECK (min_gap_nights BETWEEN 1 AND 30),
  max_campaign_days INTEGER NOT NULL DEFAULT 90 CHECK (max_campaign_days BETWEEN 30 AND 180),
  last_minute_days INTEGER NOT NULL DEFAULT 7 CHECK (last_minute_days BETWEEN 1 AND 30),
  whatsapp_cta INTEGER NOT NULL DEFAULT 1 CHECK (whatsapp_cta IN (0, 1)),
  website_cta INTEGER NOT NULL DEFAULT 0 CHECK (website_cta IN (0, 1)),
  content_mix_json TEXT NOT NULL DEFAULT '{"villa":40,"availability":30,"region":20,"special":10}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_brand_profiles (
  villa TEXT PRIMARY KEY CHECK (villa IN ('Safira', 'Destan')),
  display_name TEXT NOT NULL,
  instagram_username TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  default_cta TEXT NOT NULL DEFAULT 'Rezervasyon ve bilgi için DM / WhatsApp',
  emoji_style TEXT NOT NULL DEFAULT 'natural',
  custom_templates_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instagram_scheduled_campaigns (
  scheduled_post_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL UNIQUE,
  availability_start TEXT,
  availability_end TEXT,
  template_id TEXT,
  media_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS instagram_scheduled_campaign_window_idx
ON instagram_scheduled_campaigns (availability_start, availability_end);

CREATE TABLE IF NOT EXISTS social_ignored_availability (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  ignored_at TEXT NOT NULL,
  UNIQUE (villa, start_date, end_date)
);

CREATE TABLE IF NOT EXISTS instagram_account_insights_daily (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  instagram_user_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  followers INTEGER,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE (villa, snapshot_date)
);

CREATE INDEX IF NOT EXISTS instagram_account_insights_date_idx
ON instagram_account_insights_daily (villa, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS instagram_media_insights (
  id TEXT PRIMARY KEY,
  villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
  instagram_media_id TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL,
  published_at TEXT,
  caption_preview TEXT NOT NULL DEFAULT '',
  metrics_json TEXT NOT NULL DEFAULT '{}',
  last_synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS instagram_media_insights_sync_idx
ON instagram_media_insights (villa, last_synced_at DESC);

CREATE TABLE IF NOT EXISTS instagram_insights_sync_state (
  villa TEXT PRIMARY KEY CHECK (villa IN ('Safira', 'Destan')),
  last_bucket TEXT,
  last_success_at TEXT,
  permission_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (permission_status IN ('unknown', 'ready', 'reauthorization_required', 'error')),
  last_error TEXT,
  updated_at TEXT NOT NULL
);
