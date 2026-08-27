import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import { addDays, getVillaAvailabilityWindows, isoDate } from "./social-availability";
import { detectDuplicateContent, hashCaption, selectRotatingMedia } from "./social-rules";
import type { Reservation, Villa } from "./types";

export type SocialVillaSettings = {
  villa: Villa;
  pilotEnabled: boolean;
  weeklyTarget: number;
  preferredTimes: string[];
  includePrice: boolean;
  minGapNights: number;
  maxCampaignDays: number;
  lastMinuteDays: number;
  whatsappCta: boolean;
  websiteCta: boolean;
  contentMix: { villa: number; availability: number; region: number; special: number };
};

export type SocialBrandProfile = {
  villa: Villa;
  displayName: string;
  instagramUsername: string;
  website: string;
  whatsapp: string;
  defaultCta: string;
  emojiStyle: string;
  customTemplates: string[];
};

export type SocialMediaLibraryItem = {
  id: string;
  villa: Villa;
  mediaType: "IMAGE" | "VIDEO";
  key: string;
  publicUrl: string;
  filename: string;
  label: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  useCount: number;
  active: boolean;
  favorite: boolean;
};

export type SocialCampaign = {
  id: string;
  villa: Villa;
  campaignType: string;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  nights: number | null;
  mediaIds: string[];
  caption: string;
  captionHash: string | null;
  templateId: string | null;
  status: "draft" | "approved" | "scheduled" | "published" | "ignored" | "cancelled";
  source: "manual" | "availability" | "automation";
  contentCategory: string | null;
  createdAt: string;
  updatedAt: string;
  scheduledPostId: string | null;
  ignoredAt: string | null;
};

type SettingsRow = {
  villa: Villa;
  pilot_enabled: number;
  weekly_target: number;
  preferred_times_json: string;
  include_price: number;
  min_gap_nights: number;
  max_campaign_days: number;
  last_minute_days: number;
  whatsapp_cta: number;
  website_cta: number;
  content_mix_json: string;
};

type BrandRow = {
  villa: Villa;
  display_name: string;
  instagram_username: string;
  website: string;
  whatsapp: string;
  default_cta: string;
  emoji_style: string;
  custom_templates_json: string;
};

type MediaRow = {
  id: string;
  villa: Villa;
  media_type: "IMAGE" | "VIDEO";
  kv_key: string;
  public_url: string;
  filename: string;
  label: string;
  category: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  use_count: number;
  active: number;
  favorite: number;
};

type CampaignRow = {
  id: string;
  villa: Villa;
  campaign_type: string;
  availability_start: string | null;
  availability_end: string | null;
  nights: number | null;
  media_ids_json: string;
  caption: string;
  caption_hash: string | null;
  template_id: string | null;
  status: SocialCampaign["status"];
  source: SocialCampaign["source"];
  content_category: string | null;
  created_at: string;
  updated_at: string;
  scheduled_post_id: string | null;
  ignored_at: string | null;
};

function jsonArray(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function jsonObject<T>(value: string, fallback: T): T {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as T
      : fallback;
  } catch {
    return fallback;
  }
}

export const DEFAULT_SOCIAL_SETTINGS: Omit<SocialVillaSettings, "villa"> = {
  pilotEnabled: false,
  weeklyTarget: 3,
  preferredTimes: ["11:30", "19:30", "21:00"],
  includePrice: false,
  minGapNights: 1,
  maxCampaignDays: 90,
  lastMinuteDays: 7,
  whatsappCta: true,
  websiteCta: false,
  contentMix: { villa: 40, availability: 30, region: 20, special: 10 },
};

export function defaultBrand(villa: Villa): SocialBrandProfile {
  return {
    villa,
    displayName: `Villa ${villa}`,
    instagramUsername: villa === "Destan" ? "villadestanpatara" : "villasafirapatara",
    website: "",
    whatsapp: "",
    defaultCta: "Rezervasyon ve bilgi için DM / WhatsApp",
    emojiStyle: "natural",
    customTemplates: [],
  };
}

export async function socialOperationsDb() {
  const { env } = await getCloudflareContext({ async: true });
  return { db: env.DB, env };
}

export async function ensureSocialOperationsTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS social_campaign_drafts (
      id TEXT PRIMARY KEY, villa TEXT NOT NULL CHECK (villa IN ('Safira','Destan')),
      campaign_type TEXT NOT NULL, availability_start TEXT, availability_end TEXT,
      nights INTEGER, media_ids_json TEXT NOT NULL DEFAULT '[]', caption TEXT NOT NULL DEFAULT '',
      caption_hash TEXT, template_id TEXT, status TEXT NOT NULL DEFAULT 'draft',
      source TEXT NOT NULL DEFAULT 'manual', content_category TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, scheduled_post_id TEXT, ignored_at TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS social_campaign_window_idx
      ON social_campaign_drafts (villa, availability_start, availability_end, status)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS social_media_library (
      id TEXT PRIMARY KEY, villa TEXT NOT NULL CHECK (villa IN ('Safira','Destan')),
      media_type TEXT NOT NULL CHECK (media_type IN ('IMAGE','VIDEO')), kv_key TEXT NOT NULL UNIQUE,
      public_url TEXT NOT NULL, filename TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      last_used_at TEXT, use_count INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
      favorite INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS social_villa_settings (
      villa TEXT PRIMARY KEY CHECK (villa IN ('Safira','Destan')), pilot_enabled INTEGER NOT NULL DEFAULT 0,
      weekly_target INTEGER NOT NULL DEFAULT 3, preferred_times_json TEXT NOT NULL,
      include_price INTEGER NOT NULL DEFAULT 0, min_gap_nights INTEGER NOT NULL DEFAULT 1,
      max_campaign_days INTEGER NOT NULL DEFAULT 90, last_minute_days INTEGER NOT NULL DEFAULT 7,
      whatsapp_cta INTEGER NOT NULL DEFAULT 1, website_cta INTEGER NOT NULL DEFAULT 0,
      content_mix_json TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS social_brand_profiles (
      villa TEXT PRIMARY KEY CHECK (villa IN ('Safira','Destan')), display_name TEXT NOT NULL,
      instagram_username TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '', whatsapp TEXT NOT NULL DEFAULT '',
      default_cta TEXT NOT NULL, emoji_style TEXT NOT NULL DEFAULT 'natural',
      custom_templates_json TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS instagram_scheduled_campaigns (
      scheduled_post_id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL UNIQUE, availability_start TEXT,
      availability_end TEXT, template_id TEXT, media_ids_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS social_ignored_availability (
      id TEXT PRIMARY KEY, villa TEXT NOT NULL CHECK (villa IN ('Safira','Destan')),
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, ignored_at TEXT NOT NULL,
      UNIQUE (villa, start_date, end_date))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS instagram_account_insights_daily (
      id TEXT PRIMARY KEY, villa TEXT NOT NULL, instagram_user_id TEXT NOT NULL, snapshot_date TEXT NOT NULL,
      followers INTEGER, metrics_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL,
      UNIQUE (villa, snapshot_date))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS instagram_media_insights (
      id TEXT PRIMARY KEY, villa TEXT NOT NULL, instagram_media_id TEXT NOT NULL UNIQUE,
      media_type TEXT NOT NULL, published_at TEXT, caption_preview TEXT NOT NULL DEFAULT '',
      metrics_json TEXT NOT NULL DEFAULT '{}', last_synced_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS instagram_insights_sync_state (
      villa TEXT PRIMARY KEY, last_bucket TEXT, last_success_at TEXT, permission_status TEXT NOT NULL DEFAULT 'unknown',
      last_error TEXT, updated_at TEXT NOT NULL)`),
  ]);
}

function mapSettings(row: SettingsRow): SocialVillaSettings {
  return {
    villa: row.villa,
    pilotEnabled: row.pilot_enabled === 1,
    weeklyTarget: row.weekly_target,
    preferredTimes: jsonArray(row.preferred_times_json),
    includePrice: row.include_price === 1,
    minGapNights: row.min_gap_nights,
    maxCampaignDays: row.max_campaign_days,
    lastMinuteDays: row.last_minute_days,
    whatsappCta: row.whatsapp_cta === 1,
    websiteCta: row.website_cta === 1,
    contentMix: jsonObject(row.content_mix_json, DEFAULT_SOCIAL_SETTINGS.contentMix),
  };
}

export async function getSocialSettings(db: D1Database, villa: Villa) {
  await ensureSocialOperationsTables(db);
  const row = await db.prepare("SELECT * FROM social_villa_settings WHERE villa=?").bind(villa).first<SettingsRow>();
  return row ? mapSettings(row) : { villa, ...DEFAULT_SOCIAL_SETTINGS };
}

export async function saveSocialSettings(db: D1Database, input: SocialVillaSettings) {
  if (input.weeklyTarget < 1 || input.weeklyTarget > 7) throw new Error("Haftalık hedef 1-7 olmalı.");
  if (input.preferredTimes.length < 1 || input.preferredTimes.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
    throw new Error("Yayın saatleri SS:DD biçiminde olmalı.");
  }
  const mixTotal = Object.values(input.contentMix).reduce((sum, value) => sum + value, 0);
  if (mixTotal !== 100) throw new Error("İçerik dağılımı toplamı %100 olmalı.");
  await ensureSocialOperationsTables(db);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO social_villa_settings
    (villa,pilot_enabled,weekly_target,preferred_times_json,include_price,min_gap_nights,max_campaign_days,
     last_minute_days,whatsapp_cta,website_cta,content_mix_json,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(villa) DO UPDATE SET
      pilot_enabled=excluded.pilot_enabled, weekly_target=excluded.weekly_target,
      preferred_times_json=excluded.preferred_times_json, include_price=excluded.include_price,
      min_gap_nights=excluded.min_gap_nights, max_campaign_days=excluded.max_campaign_days,
      last_minute_days=excluded.last_minute_days, whatsapp_cta=excluded.whatsapp_cta,
      website_cta=excluded.website_cta, content_mix_json=excluded.content_mix_json, updated_at=excluded.updated_at`)
    .bind(input.villa, Number(input.pilotEnabled), input.weeklyTarget, JSON.stringify(input.preferredTimes),
      Number(input.includePrice), input.minGapNights, input.maxCampaignDays, input.lastMinuteDays,
      Number(input.whatsappCta), Number(input.websiteCta), JSON.stringify(input.contentMix), now).run();
  return input;
}

function mapBrand(row: BrandRow): SocialBrandProfile {
  return { villa: row.villa, displayName: row.display_name, instagramUsername: row.instagram_username,
    website: row.website, whatsapp: row.whatsapp, defaultCta: row.default_cta,
    emojiStyle: row.emoji_style, customTemplates: jsonArray(row.custom_templates_json) };
}

export async function getBrandProfile(db: D1Database, villa: Villa) {
  await ensureSocialOperationsTables(db);
  const row = await db.prepare("SELECT * FROM social_brand_profiles WHERE villa=?").bind(villa).first<BrandRow>();
  return row ? mapBrand(row) : defaultBrand(villa);
}

export async function saveBrandProfile(db: D1Database, input: SocialBrandProfile) {
  await ensureSocialOperationsTables(db);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO social_brand_profiles
    (villa,display_name,instagram_username,website,whatsapp,default_cta,emoji_style,custom_templates_json,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(villa) DO UPDATE SET display_name=excluded.display_name,
      instagram_username=excluded.instagram_username, website=excluded.website, whatsapp=excluded.whatsapp,
      default_cta=excluded.default_cta, emoji_style=excluded.emoji_style,
      custom_templates_json=excluded.custom_templates_json, updated_at=excluded.updated_at`)
    .bind(input.villa, input.displayName.slice(0, 80), input.instagramUsername.slice(0, 80), input.website.slice(0, 300),
      input.whatsapp.slice(0, 40), input.defaultCta.slice(0, 300), input.emojiStyle.slice(0, 30),
      JSON.stringify(input.customTemplates.slice(0, 30)), now).run();
  return input;
}

function mapMedia(row: MediaRow): SocialMediaLibraryItem {
  return { id: row.id, villa: row.villa, mediaType: row.media_type, key: row.kv_key,
    publicUrl: row.public_url, filename: row.filename, label: row.label, category: row.category,
    createdAt: row.created_at, updatedAt: row.updated_at, lastUsedAt: row.last_used_at,
    useCount: row.use_count, active: row.active === 1, favorite: row.favorite === 1 };
}

export async function listMediaLibrary(db: D1Database, villa?: Villa) {
  await ensureSocialOperationsTables(db);
  const statement = villa
    ? db.prepare("SELECT * FROM social_media_library WHERE villa=? ORDER BY active DESC, favorite DESC, created_at DESC").bind(villa)
    : db.prepare("SELECT * FROM social_media_library ORDER BY villa, active DESC, favorite DESC, created_at DESC");
  const result = await statement.all<MediaRow>();
  return result.results.map(mapMedia);
}

export async function addMediaLibraryItem(db: D1Database, input: Omit<SocialMediaLibraryItem, "createdAt" | "updatedAt" | "lastUsedAt" | "useCount" | "active" | "favorite">) {
  await ensureSocialOperationsTables(db);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO social_media_library
    (id,villa,media_type,kv_key,public_url,filename,label,category,created_at,updated_at,last_used_at,use_count,active,favorite)
    VALUES (?,?,?,?,?,?,?,?,?,?,NULL,0,1,0)`)
    .bind(input.id, input.villa, input.mediaType, input.key, input.publicUrl, input.filename.slice(0, 180),
      input.label.slice(0, 120), input.category.slice(0, 60), now, now).run();
  const row = await db.prepare("SELECT * FROM social_media_library WHERE id=?").bind(input.id).first<MediaRow>();
  return row ? mapMedia(row) : null;
}

export async function updateMediaLibraryItem(db: D1Database, id: string, input: { label?: string; category?: string; active?: boolean; favorite?: boolean }) {
  await ensureSocialOperationsTables(db);
  const current = await db.prepare("SELECT * FROM social_media_library WHERE id=?").bind(id).first<MediaRow>();
  if (!current) return null;
  await db.prepare(`UPDATE social_media_library SET label=?,category=?,active=?,favorite=?,updated_at=? WHERE id=?`)
    .bind(input.label?.slice(0, 120) ?? current.label, input.category?.slice(0, 60) ?? current.category,
      input.active === undefined ? current.active : Number(input.active),
      input.favorite === undefined ? current.favorite : Number(input.favorite), new Date().toISOString(), id).run();
  const row = await db.prepare("SELECT * FROM social_media_library WHERE id=?").bind(id).first<MediaRow>();
  return row ? mapMedia(row) : null;
}

export async function deactivateMediaLibraryItem(db: D1Database, id: string) {
  await ensureSocialOperationsTables(db);
  const result = await db.prepare("UPDATE social_media_library SET active=0,updated_at=? WHERE id=?")
    .bind(new Date().toISOString(), id).run();
  return (result.meta.changes ?? 0) === 1;
}

function mapCampaign(row: CampaignRow): SocialCampaign {
  return { id: row.id, villa: row.villa, campaignType: row.campaign_type,
    availabilityStart: row.availability_start, availabilityEnd: row.availability_end, nights: row.nights,
    mediaIds: jsonArray(row.media_ids_json), caption: row.caption, captionHash: row.caption_hash,
    templateId: row.template_id, status: row.status, source: row.source,
    contentCategory: row.content_category, createdAt: row.created_at, updatedAt: row.updated_at,
    scheduledPostId: row.scheduled_post_id, ignoredAt: row.ignored_at };
}

export async function listCampaigns(db: D1Database, limit = 200) {
  await ensureSocialOperationsTables(db);
  const result = await db.prepare(`SELECT * FROM social_campaign_drafts ORDER BY created_at DESC LIMIT ?`)
    .bind(Math.min(500, Math.max(1, limit))).all<CampaignRow>();
  return result.results.map(mapCampaign);
}

export async function getCampaign(db: D1Database, id: string) {
  await ensureSocialOperationsTables(db);
  const row = await db.prepare("SELECT * FROM social_campaign_drafts WHERE id=?").bind(id).first<CampaignRow>();
  return row ? mapCampaign(row) : null;
}

export async function updateCampaignDraft(
  db: D1Database,
  id: string,
  input: { caption?: string; mediaIds?: string[]; contentCategory?: string },
) {
  const current = await getCampaign(db, id);
  if (!current || !["draft", "approved"].includes(current.status)) return null;
  const caption = input.caption?.trim() ?? current.caption;
  if (!caption || caption.length > 2200) throw new Error("Paylaşım metni 1-2200 karakter olmalı.");
  const mediaIds = input.mediaIds ?? current.mediaIds;
  await db.prepare(`UPDATE social_campaign_drafts SET caption=?,caption_hash=?,media_ids_json=?,
    content_category=?,updated_at=? WHERE id=? AND status IN ('draft','approved')`)
    .bind(caption, hashCaption(caption), JSON.stringify(mediaIds), input.contentCategory ?? current.contentCategory,
      new Date().toISOString(), id).run();
  return getCampaign(db, id);
}

export async function createCampaign(db: D1Database, input: {
  villa: Villa; campaignType: string; availabilityStart?: string | null; availabilityEnd?: string | null;
  nights?: number | null; mediaIds: string[]; caption: string; templateId?: string | null;
  source: SocialCampaign["source"]; contentCategory?: string | null;
}) {
  await ensureSocialOperationsTables(db);
  const recent = await db.prepare(`SELECT * FROM social_campaign_drafts WHERE villa=? AND created_at>=?
    AND status NOT IN ('ignored','cancelled') ORDER BY created_at DESC`)
    .bind(input.villa, new Date(Date.now() - 30 * 86_400_000).toISOString()).all<CampaignRow>();
  const captionHash = hashCaption(input.caption);
  const duplicate = detectDuplicateContent({ villa: input.villa, captionHash, mediaIds: input.mediaIds,
    templateId: input.templateId, availabilityStart: input.availabilityStart, availabilityEnd: input.availabilityEnd },
    recent.results.map((row) => ({ villa: row.villa, captionHash: row.caption_hash, mediaIds: jsonArray(row.media_ids_json),
      templateId: row.template_id, availabilityStart: row.availability_start, availabilityEnd: row.availability_end,
      publishedOrScheduledAt: row.created_at })));
  if (duplicate) throw new Error("Aynı müsaitlik veya içerik için son 30 günde zaten bir kampanya var.");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO social_campaign_drafts
    (id,villa,campaign_type,availability_start,availability_end,nights,media_ids_json,caption,caption_hash,
     template_id,status,source,content_category,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,'draft',?,?,?,?)`)
    .bind(id, input.villa, input.campaignType, input.availabilityStart ?? null, input.availabilityEnd ?? null,
      input.nights ?? null, JSON.stringify(input.mediaIds), input.caption.slice(0, 2200), captionHash,
      input.templateId ?? null, input.source, input.contentCategory ?? "Müsaitlik", now, now).run();
  const row = await db.prepare("SELECT * FROM social_campaign_drafts WHERE id=?").bind(id).first<CampaignRow>();
  return row ? mapCampaign(row) : null;
}

export async function ignoreAvailability(db: D1Database, villa: Villa, startDate: string, endDate: string) {
  await ensureSocialOperationsTables(db);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO social_ignored_availability (id,villa,start_date,end_date,ignored_at)
    VALUES (?,?,?,?,?) ON CONFLICT(villa,start_date,end_date) DO UPDATE SET ignored_at=excluded.ignored_at`)
    .bind(crypto.randomUUID(), villa, startDate, endDate, now).run();
}

export async function listAvailability(db: D1Database, horizonDays = 90) {
  await ensureSocialOperationsTables(db);
  const today = isoDate(new Date());
  const end = addDays(today, Math.min(180, Math.max(30, horizonDays)));
  const reservations = await db.prepare(`SELECT id,villa,guest_name,phone,check_in,check_out,channel,
    nightly_rate,total_amount,paid_amount,notes,created_at,updated_at FROM reservations
    WHERE deleted_at IS NULL AND check_in < ? AND check_out > ?`).bind(end, today).all<{
      id: string; villa: Villa; guest_name: string; phone: string; check_in: string; check_out: string;
      channel: Reservation["channel"]; nightly_rate: number; total_amount: number; paid_amount: number;
      notes: string; created_at: string; updated_at: string;
    }>();
  const ignored = await db.prepare("SELECT villa,start_date,end_date FROM social_ignored_availability").all<{
    villa: Villa; start_date: string; end_date: string;
  }>();
  const mapped: Reservation[] = reservations.results.map((row) => ({ id: row.id, villa: row.villa,
    guestName: row.guest_name, phone: row.phone, checkIn: row.check_in, checkOut: row.check_out,
    channel: row.channel, nightlyRate: row.nightly_rate, totalAmount: row.total_amount,
    paidAmount: row.paid_amount, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at }));
  const settings = await Promise.all((["Destan", "Safira"] as const).map((villa) => getSocialSettings(db, villa)));
  return settings.flatMap((setting) => getVillaAvailabilityWindows(setting.villa, today, end, mapped, {
    today, minNights: setting.minGapNights, lastMinuteDays: setting.lastMinuteDays,
  })).filter((gap) => !ignored.results.some((item) => item.villa === gap.villa &&
    item.start_date === gap.startDate && item.end_date === gap.endDate));
}

export async function availabilityPriceText(
  db: D1Database,
  villa: Villa,
  startDate: string,
  endDate: string,
) {
  const ranges = await db.prepare(`SELECT start_date,end_date,nightly_rate FROM price_ranges
    WHERE villa=? AND start_date < ? AND end_date >= ? ORDER BY start_date`)
    .bind(villa, endDate, startDate).all<{ start_date: string; end_date: string; nightly_rate: number }>();
  let total = 0;
  let nights = 0;
  for (let date = startDate; date < endDate; date = addDays(date, 1)) {
    const range = ranges.results.find((item) => item.start_date <= date && item.end_date >= date);
    if (!range || !Number.isFinite(range.nightly_rate)) return null;
    total += range.nightly_rate;
    nights += 1;
  }
  if (!nights) return null;
  const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
  return `${nights} gece toplam ${money.format(total)}`;
}

export async function suggestLibraryMedia(db: D1Database, villa: Villa, mediaType: "IMAGE" | "VIDEO" = "IMAGE") {
  const items = (await listMediaLibrary(db, villa)).filter((item) => item.mediaType === mediaType);
  const recent = await db.prepare(`SELECT media_ids_json,content_category FROM social_campaign_drafts
    WHERE villa=? AND status IN ('scheduled','published') ORDER BY updated_at DESC LIMIT 3`).bind(villa)
    .all<{ media_ids_json: string; content_category: string | null }>();
  const mediaIds = recent.results.flatMap((row) => jsonArray(row.media_ids_json));
  const categories = recent.results.map((row) => row.content_category ?? "");
  return selectRotatingMedia(items, mediaIds, categories);
}

export async function attachScheduledCampaign(db: D1Database, campaignId: string, scheduledPostId: string) {
  await ensureSocialOperationsTables(db);
  const campaign = await db.prepare("SELECT * FROM social_campaign_drafts WHERE id=?").bind(campaignId).first<CampaignRow>();
  if (!campaign) throw new Error("Kampanya bulunamadı.");
  const now = new Date().toISOString();
  const mediaIds = jsonArray(campaign.media_ids_json);
  await db.batch([
    db.prepare(`UPDATE social_campaign_drafts SET status='scheduled',scheduled_post_id=?,updated_at=?
      WHERE id=? AND status IN ('draft','approved')`).bind(scheduledPostId, now, campaignId),
    db.prepare(`INSERT INTO instagram_scheduled_campaigns
      (scheduled_post_id,campaign_id,availability_start,availability_end,template_id,media_ids_json,created_at)
      VALUES (?,?,?,?,?,?,?)`).bind(scheduledPostId, campaignId, campaign.availability_start,
      campaign.availability_end, campaign.template_id, JSON.stringify(mediaIds), now),
    ...mediaIds.map((id) => db.prepare(`UPDATE social_media_library SET use_count=use_count+1,last_used_at=?,updated_at=? WHERE id=?`)
      .bind(now, now, id)),
  ]);
}

export async function revalidateAvailabilityCampaigns(db: D1Database, villa: Villa) {
  await ensureSocialOperationsTables(db);
  const collisions = await db.prepare(`SELECT campaign.id AS campaign_id,campaign.scheduled_post_id
    FROM social_campaign_drafts campaign WHERE campaign.villa=? AND campaign.status='scheduled'
      AND campaign.availability_start IS NOT NULL AND campaign.availability_end IS NOT NULL
      AND EXISTS (SELECT 1 FROM reservations reservation WHERE reservation.villa=campaign.villa
        AND reservation.deleted_at IS NULL AND reservation.check_in < campaign.availability_end
        AND reservation.check_out > campaign.availability_start)`).bind(villa)
    .all<{ campaign_id: string; scheduled_post_id: string | null }>();
  const now = new Date().toISOString();
  for (const item of collisions.results) {
    const statements = [db.prepare(`UPDATE social_campaign_drafts SET status='cancelled',updated_at=? WHERE id=? AND status='scheduled'`)
      .bind(now, item.campaign_id)];
    if (item.scheduled_post_id) statements.push(db.prepare(`UPDATE instagram_scheduled_posts SET status='cancelled',updated_at=?,locked_at=NULL,next_attempt_at=NULL
      WHERE id=? AND status IN ('scheduled','failed')`).bind(now, item.scheduled_post_id));
    await db.batch(statements);
  }
  return collisions.results.length;
}

export async function validateScheduledCampaignAvailability(db: D1Database, scheduledPostId: string) {
  await ensureSocialOperationsTables(db);
  const row = await db.prepare(`SELECT mapping.campaign_id,mapping.availability_start,mapping.availability_end,campaign.villa
    FROM instagram_scheduled_campaigns mapping JOIN social_campaign_drafts campaign ON campaign.id=mapping.campaign_id
    WHERE mapping.scheduled_post_id=?`).bind(scheduledPostId).first<{
      campaign_id: string; availability_start: string | null; availability_end: string | null; villa: Villa;
    }>();
  if (!row?.availability_start || !row.availability_end) return true;
  const collision = await db.prepare(`SELECT 1 FROM reservations WHERE villa=? AND deleted_at IS NULL
    AND check_in < ? AND check_out > ? LIMIT 1`).bind(row.villa, row.availability_end, row.availability_start).first();
  if (!collision) return true;
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE social_campaign_drafts SET status='cancelled',updated_at=? WHERE id=?`).bind(now, row.campaign_id),
    db.prepare(`UPDATE instagram_scheduled_posts SET status='cancelled',updated_at=?,locked_at=NULL,next_attempt_at=NULL
      WHERE id=? AND status IN ('scheduled','processing','failed')`).bind(now, scheduledPostId),
  ]);
  return false;
}
