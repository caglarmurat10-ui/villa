import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

// Faz 6 bölüm 4 - Dinamik yerel etkinlik motoru. Bu dosya GERÇEK bir otomatik web scraper/kron DEĞİL
// - hiçbir kaynağın (Kaş Belediyesi, Antalya/Kaş resmi kültür-turizm siteleri) canlı, güvenilir bir
// API'si yok ve buraya bir tane UYDURULAMAZ. Bunun yerine haftalık bir İNSAN KONTROLÜ iş akışını
// destekleyen bir VERİ MODELİ + CRUD sağlar: admin ilgili kaynakları haftada bir elle kontrol eder,
// gerçek bulduğu bir etkinliği kaynak URL + retrieved_at ile birlikte burada kaydeder. Hiçbir aday
// otomatik olarak AUTO_SAFE/'approved' olmaz (bkz. section 4 "Etkinlik otomatik olarak AUTO_SAFE
// sayılmasın") - yalnız admin'in EXPLICIT approve action'ı statüyü değiştirir.

export type LocalEventStatus = "pending_review" | "approved" | "rejected" | "published";

export interface LocalEventCandidate {
  id: string;
  title: string;
  description: string;
  eventDate: string; // YYYY-MM-DD
  eventDateEnd: string | null;
  venue: string;
  feeInfo: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  status: LocalEventStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalEventCandidateInput {
  title: string;
  description?: string;
  eventDate: string;
  eventDateEnd?: string | null;
  venue?: string;
  feeInfo?: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt?: string;
  createdBy?: string;
}

type LocalEventRow = {
  id: string; title: string; description: string; event_date: string; event_date_end: string | null;
  venue: string; fee_info: string; source_name: string; source_url: string; retrieved_at: string;
  status: LocalEventStatus; created_by: string; created_at: string; updated_at: string;
};

function mapRow(row: LocalEventRow): LocalEventCandidate {
  return {
    id: row.id, title: row.title, description: row.description, eventDate: row.event_date,
    eventDateEnd: row.event_date_end, venue: row.venue, feeInfo: row.fee_info,
    sourceName: row.source_name, sourceUrl: row.source_url, retrievedAt: row.retrieved_at,
    status: row.status, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

// Kaynak yoksa (source_url/source_name boşsa) kayıt hiç OLUŞTURULMAZ - bkz. section 4
// "Kaynak yoksa: REVIEW_REQUIRED" ilkesinin en katı hali: kaynaksız bir aday D1'e bile girmez.
export async function createLocalEventCandidate(input: LocalEventCandidateInput): Promise<LocalEventCandidate> {
  if (!input.sourceUrl.trim() || !input.sourceName.trim()) {
    throw new Error("Kaynak (sourceName + sourceUrl) zorunludur - kaynaksız etkinlik adayı kaydedilemez.");
  }
  const db = await database();
  const now = new Date().toISOString();
  const row: LocalEventRow = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    event_date: input.eventDate,
    event_date_end: input.eventDateEnd ?? null,
    venue: input.venue?.trim() ?? "",
    fee_info: input.feeInfo?.trim() ?? "",
    source_name: input.sourceName.trim(),
    source_url: input.sourceUrl.trim(),
    retrieved_at: input.retrievedAt ?? now,
    status: "pending_review",
    created_by: input.createdBy?.trim() || "admin",
    created_at: now,
    updated_at: now,
  };
  await db.prepare(
    `INSERT INTO local_event_candidates
     (id, title, description, event_date, event_date_end, venue, fee_info, source_name, source_url, retrieved_at, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(row.id, row.title, row.description, row.event_date, row.event_date_end, row.venue, row.fee_info, row.source_name, row.source_url, row.retrieved_at, row.status, row.created_by, row.created_at, row.updated_at).run();
  return mapRow(row);
}

export async function listLocalEventCandidates(status?: LocalEventStatus): Promise<LocalEventCandidate[]> {
  const db = await database();
  const result = status
    ? await db.prepare("SELECT * FROM local_event_candidates WHERE status = ? ORDER BY event_date ASC").bind(status).all<LocalEventRow>()
    : await db.prepare("SELECT * FROM local_event_candidates ORDER BY event_date ASC").all<LocalEventRow>();
  return result.results.map(mapRow);
}

export async function getLocalEventCandidate(id: string): Promise<LocalEventCandidate | null> {
  const db = await database();
  const row = await db.prepare("SELECT * FROM local_event_candidates WHERE id = ?").bind(id).first<LocalEventRow>();
  return row ? mapRow(row) : null;
}

// Yalnız admin'in EXPLICIT bir aksiyonu bu statüyü değiştirir - hiçbir otomatik/zamanlanmış görev
// bunu çağırmaz. "approved" bile otomatik AUTO_SAFE/yayın DEĞİLDİR - yalnız "bu etkinlik gerçek ve
// doğrulandı, taslak post oluşturulabilir" anlamına gelir (bkz. social-plan-seed.ts
// ensureLocalEventDraftPosts, oluşan post yine approval_status='İnsan onayı' ile eklenir).
export async function setLocalEventCandidateStatus(id: string, status: LocalEventStatus): Promise<LocalEventCandidate | null> {
  const db = await database();
  const now = new Date().toISOString();
  await db.prepare("UPDATE local_event_candidates SET status = ?, updated_at = ? WHERE id = ?").bind(status, now, id).run();
  return getLocalEventCandidate(id);
}

// "Eski etkinliği yeniden yayınlama" (section 4) - event_date bugünden önce olan bir aday artık
// aday listesinde ÖNCELİKLİ görünmemeli/taslak post üretilmemeli. Bu SAF bir tarih karşılaştırması,
// D1'den silme değildir (geçmiş kayıt denetim/rapor amaçlı saklanır).
export function isPastEvent(candidate: Pick<LocalEventCandidate, "eventDate">, todayIso: string): boolean {
  return candidate.eventDate < todayIso;
}
