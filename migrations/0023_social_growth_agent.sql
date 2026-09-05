-- Social Growth Agent - Faz 1 (güvenli iskelet, izin gerektirmeyen kısım).
-- Bu dört tablo, hashtag/business discovery, comment/mention/DM ajanları için hazır bir veri
-- modeli sağlar - ancak bu ajanlar Meta'da instagram_business_manage_comments/messages/insights
-- ve "Instagram Public Content Access" izinleri GRANTED olmadan hiçbir satır YAZMAZ (bkz.
-- src/lib/social-growth-capabilities.ts). Tablolar bu migration ile boş oluşturulur; gerçek
-- runtime kaynağı src/lib/social-growth-store.ts'teki ensureTables() self-heal deseni (repo
-- konvansiyonu, bkz. src/lib/meta-store.ts) - bu dosya yalnız dokümantasyon/test şeması içindir.

CREATE TABLE IF NOT EXISTS social_prospects (
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
);

CREATE INDEX IF NOT EXISTS social_prospects_status_idx ON social_prospects (status, villa);

CREATE TABLE IF NOT EXISTS social_prospect_media (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  media_id TEXT,
  media_type TEXT,
  caption_summary TEXT,
  permalink TEXT,
  discovered_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS social_prospect_media_prospect_idx ON social_prospect_media (prospect_id);

-- Üçüncü taraf içeriklerinde önerilen etkileşim fırsatları. risk_classification varsayılanı
-- BİLEREK 'REVIEW_REQUIRED' - üçüncü taraf gönderilerine hiçbir yorum otomatik AUTO_SAFE olamaz.
CREATE TABLE IF NOT EXISTS social_engagement_opportunities (
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
);

CREATE INDEX IF NOT EXISTS social_engagement_opportunities_status_idx ON social_engagement_opportunities (status, villa);

-- Her ajan çalışmasının denetim izi. status='PENDING_PERMISSION' + required_permission dolu ise
-- ajan hiçbir Meta API çağrısı yapmadan (izin eksik olduğu için) durduğu anlamına gelir.
CREATE TABLE IF NOT EXISTS social_agent_runs (
  id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('SCOUT','INSIGHTS','COMMENTS','MENTIONS','DM','PROSPECT_REFRESH')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_PERMISSION' CHECK (status IN ('OK','ERROR','PENDING_PERMISSION','PENDING_CONFIGURATION')),
  candidate_count INTEGER NOT NULL DEFAULT 0,
  required_permission TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS social_agent_runs_type_idx ON social_agent_runs (agent_type, started_at);
