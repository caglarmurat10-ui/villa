import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import { computeCheckoutReminderScheduledAt, istanbulTodayIso } from "./schedule";
import { isValidWhatsappPhone, normalizeWhatsappPhone } from "./phone";
import type { WhatsappMessageStatus, WhatsappScheduledMessage } from "./types";

// checkout_date - 1 gün, 11:00 Europe/Istanbul geldiğinde gönderilecek hatırlatmanın MANTIKSAL
// şablon adı - gerçek, Meta'da onaylı şablon adı (WHATSAPP_CHECKOUT_TEMPLATE_NAME) yalnız dispatch
// anında config.ts'ten okunur ve bu alanın üzerine YAZILIR (bkz. claimAndResolveTemplate). Kayıt
// oluşturma anında henüz kimlik bilgisi yapılandırılmamış olabilir - bu placeholder o boşluğu
// doldurur, hiçbir sahte gönderim ima etmez.
const LOGICAL_CHECKOUT_TEMPLATE_NAME = "checkout_reminder";

type MessageRow = {
  id: string;
  reservation_id: string;
  message_type: WhatsappScheduledMessage["messageType"];
  checkout_date: string;
  scheduled_at: string;
  recipient_phone: string;
  template_name: string;
  status: WhatsappMessageStatus;
  provider_message_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  auto_enabled: number;
  created_at: string;
  updated_at: string;
};

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

let tableReady: Promise<void> | null = null;

async function prepareTable(db: D1Database): Promise<void> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS whatsapp_scheduled_messages (
      id TEXT PRIMARY KEY, reservation_id TEXT NOT NULL, message_type TEXT NOT NULL,
      checkout_date TEXT NOT NULL, scheduled_at TEXT NOT NULL, recipient_phone TEXT NOT NULL,
      template_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'SCHEDULED',
      provider_message_id TEXT, sent_at TEXT, delivered_at TEXT, read_at TEXT, failed_at TEXT,
      failure_reason TEXT, auto_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE (reservation_id, message_type, checkout_date)
    )`.replace(/\s+/g, " "),
  );
  await db.exec("CREATE INDEX IF NOT EXISTS whatsapp_scheduled_messages_due_idx ON whatsapp_scheduled_messages (status, scheduled_at)");
  await db.exec("CREATE INDEX IF NOT EXISTS whatsapp_scheduled_messages_reservation_idx ON whatsapp_scheduled_messages (reservation_id, message_type)");
}

async function ensureTable(db: D1Database): Promise<void> {
  if (!tableReady) {
    tableReady = prepareTable(db).catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

function mapRow(row: MessageRow): WhatsappScheduledMessage {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    messageType: row.message_type,
    checkoutDate: row.checkout_date,
    scheduledAt: row.scheduled_at,
    recipientPhone: row.recipient_phone,
    templateName: row.template_name,
    status: row.status,
    providerMessageId: row.provider_message_id,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    failedAt: row.failed_at,
    failureReason: row.failure_reason,
    autoEnabled: row.auto_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ReservationForSync {
  id: string;
  checkOut: string;
  phone: string;
}

// Rezervasyon oluşturma/güncelleme/telefon değişikliği/silme sonrası ÇAĞRILMASI GEREKEN tek
// senkronizasyon noktası (bkz. src/lib/db.ts). Idempotent: aynı rezervasyon+çıkış tarihi için tekrar
// tekrar çağrılması güvenlidir (UNIQUE + "ON CONFLICT ... WHERE status = 'SCHEDULED'" ikili koruması
// - zaten SENT/FAILED/CANCELLED bir satır asla üzerine yazılmaz).
export async function syncCheckoutReminderForReservation(reservation: ReservationForSync): Promise<void> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();

  // Çıkış tarihi değiştiyse: eski tarihe ait, hâlâ bekleyen (SCHEDULED) satırı iptal et. SENT/FAILED
  // gibi zaten sonuçlanmış bir satıra dokunulmaz - geçmiş bir gönderim asla "iptal" görünmez.
  await db.prepare(
    `UPDATE whatsapp_scheduled_messages SET status = 'CANCELLED', updated_at = ?
     WHERE reservation_id = ? AND message_type = 'CHECKOUT_REMINDER' AND status = 'SCHEDULED' AND checkout_date != ?`,
  ).bind(now, reservation.id, reservation.checkOut).run();

  const today = istanbulTodayIso();
  const validPhone = isValidWhatsappPhone(reservation.phone ?? "");
  // Geçersiz telefon veya artık aktif olmayan (çıkış günü geçmiş) rezervasyon için yeni/güncel bir
  // planlama YAPILMAZ - yalnız yukarıdaki iptal adımı uygulanmış olur.
  if (!validPhone || reservation.checkOut < today) return;

  const id = crypto.randomUUID();
  const recipientPhone = normalizeWhatsappPhone(reservation.phone);
  const scheduledAt = computeCheckoutReminderScheduledAt(reservation.checkOut);

  // INSERT ... ON CONFLICT ... DO UPDATE ... WHERE status = 'SCHEDULED': aynı (reservation_id,
  // message_type, checkout_date) için satır zaten varsa VE hâlâ SCHEDULED ise telefon/scheduled_at
  // güncellenir (telefon değişikliği senaryosu); SENT/FAILED/SKIPPED_NOT_CONFIGURED ise WHERE
  // koşulu tutmadığından hiçbir şey değişmez - "zaten gönderilmiş bir hatırlatma asla yeniden
  // gönderilmez" garantisi burada, veritabanı seviyesinde sağlanır.
  await db.prepare(
    `INSERT INTO whatsapp_scheduled_messages
      (id, reservation_id, message_type, checkout_date, scheduled_at, recipient_phone, template_name, status, auto_enabled, created_at, updated_at)
     VALUES (?, ?, 'CHECKOUT_REMINDER', ?, ?, ?, ?, 'SCHEDULED', 1, ?, ?)
     ON CONFLICT (reservation_id, message_type, checkout_date) DO UPDATE SET
       recipient_phone = excluded.recipient_phone,
       scheduled_at = excluded.scheduled_at,
       updated_at = excluded.updated_at
     WHERE whatsapp_scheduled_messages.status = 'SCHEDULED'`,
  ).bind(id, reservation.id, reservation.checkOut, scheduledAt, recipientPhone, LOGICAL_CHECKOUT_TEMPLATE_NAME, now, now).run();
}

// Rezervasyon iptal/silme (softDeleteReservation) sonrası - tarihten bağımsız, hâlâ bekleyen HER
// satırı iptal eder.
export async function cancelCheckoutReminderForReservation(reservationId: string): Promise<void> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE whatsapp_scheduled_messages SET status = 'CANCELLED', updated_at = ?
     WHERE reservation_id = ? AND message_type = 'CHECKOUT_REMINDER' AND status = 'SCHEDULED'`,
  ).bind(now, reservationId).run();
}

// "Hâlâ anlamlı/gelecekle ilgili" sınırı - Worker uzun süre durursa bile aylar önce geçmiş bir
// çıkış için anlamsız/kafa karıştırıcı bir hatırlatma göndermez (yalnız makul ölçüde gecikmiş, hâlâ
// anlamlı bir gönderim işleme alınır). listDueCheckoutReminders VE requeueSkippedNotConfiguredRemindersWhenReady
// AYNI eşiği kullanır - biri "gönderilebilir" derken diğeri "yeniden kuyruğa alınabilir" derse
// tutarsızlık olur.
function minMeaningfulCheckoutDate(nowIso: string): string {
  return istanbulTodayIso(new Date(new Date(nowIso).getTime() - 24 * 60 * 60 * 1000));
}

// custom-worker.mjs cron'unun çağırdığı dispatch route'u için: zamanı gelmiş, hâlâ bekleyen satırlar.
export async function listDueCheckoutReminders(nowIso: string, limit: number): Promise<WhatsappScheduledMessage[]> {
  const db = await database();
  await ensureTable(db);
  const result = await db.prepare(
    `SELECT * FROM whatsapp_scheduled_messages
     WHERE status = 'SCHEDULED' AND auto_enabled = 1 AND scheduled_at <= ? AND checkout_date >= ?
     ORDER BY scheduled_at ASC LIMIT ?`,
  ).bind(nowIso, minMeaningfulCheckoutDate(nowIso), limit).all<MessageRow>();
  return (result.results ?? []).map(mapRow);
}

// WhatsApp yapılandırılmadan ÖNCE "due" olup SKIPPED_NOT_CONFIGURED işaretlenen hatırlatmalar,
// yapılandırma sonradan tamamlandığında KALICI OLARAK kaybolmamalı - bu fonksiyon onları güvenle
// SCHEDULED'a geri döndürür (scheduled_at = şimdi, aynı cron turunda hemen listDueCheckoutReminders
// tarafından yakalanabilir). Yalnız dispatch-due route'unda, kimlik bilgileri GERÇEKTEN yapılandırılmışsa
// çağrılır (bkz. route.ts) - "yapılandırma READY olduğunda" koşulu orada sağlanır.
//
// GÜVENLİ OLAN NE: yalnız status = 'SKIPPED_NOT_CONFIGURED' satırlar etkilenir - SENT/DELIVERED/READ/
// CANCELLED/FAILED asla dokunulmaz (WHERE'e dahil değil). auto_enabled = 0 (admin kapatmış) veya
// checkout_date artık anlamlı değilse (geçmiş, minMeaningfulCheckoutDate altında) satır ATLANIR.
// Var olan satır YERİNDE güncellenir - yeni satır oluşturulmaz, UNIQUE(reservation_id, message_type,
// checkout_date) kısıtı hiç devreye girmez. Tekrar tekrar çağrılması idempotenttir: ilk çağrıda
// SCHEDULED olan satırlar ikinci çağrının WHERE'ine artık uymaz (status artık SKIPPED_NOT_CONFIGURED
// değil), bu yüzden bir daha etkilenmezler.
export async function requeueSkippedNotConfiguredRemindersWhenReady(nowIso: string = new Date().toISOString()): Promise<number> {
  const db = await database();
  await ensureTable(db);
  const result = await db.prepare(
    `UPDATE whatsapp_scheduled_messages SET status = 'SCHEDULED', scheduled_at = ?, updated_at = ?
     WHERE status = 'SKIPPED_NOT_CONFIGURED' AND auto_enabled = 1 AND checkout_date >= ?`,
  ).bind(nowIso, nowIso, minMeaningfulCheckoutDate(nowIso)).run();
  return result.meta.changes ?? 0;
}

// Atomik "claim": yalnız hâlâ SCHEDULED ise SENDING'e çevirir. Aynı satır iki eşzamanlı cron
// tetiklemesinde (retry-safe) yalnız BİR kez claim edilebilir - ikinci deneme 0 satır günceller ve
// false döner, tekrar göndermez.
export async function claimCheckoutReminderForSending(id: string): Promise<boolean> {
  const db = await database();
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE whatsapp_scheduled_messages SET status = 'SENDING', updated_at = ? WHERE id = ? AND status = 'SCHEDULED'`,
  ).bind(now, id).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function markCheckoutReminderSkippedNotConfigured(id: string): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE whatsapp_scheduled_messages SET status = 'SKIPPED_NOT_CONFIGURED', updated_at = ? WHERE id = ? AND status = 'SENDING'`,
  ).bind(now, id).run();
}

export async function markCheckoutReminderSent(id: string, providerMessageId: string, templateNameUsed: string): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE whatsapp_scheduled_messages
     SET status = 'SENT', provider_message_id = ?, template_name = ?, sent_at = ?, updated_at = ?
     WHERE id = ? AND status = 'SENDING'`,
  ).bind(providerMessageId, templateNameUsed, now, now, id).run();
}

export async function markCheckoutReminderFailed(id: string, reason: string, templateNameUsed: string): Promise<void> {
  const db = await database();
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE whatsapp_scheduled_messages
     SET status = 'FAILED', failure_reason = ?, template_name = ?, failed_at = ?, updated_at = ?
     WHERE id = ? AND status = 'SENDING'`,
  ).bind(reason.slice(0, 500), templateNameUsed, now, now, id).run();
}

// ============ Webhook durum güncellemeleri (provider_message_id ile eşleştirilir) ============

export async function markCheckoutReminderDeliveredByProviderMessageId(providerMessageId: string, timestampIso: string): Promise<void> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE whatsapp_scheduled_messages SET status = 'DELIVERED', delivered_at = ?, updated_at = ?
     WHERE provider_message_id = ? AND status IN ('SENT')`,
  ).bind(timestampIso, now, providerMessageId).run();
}

export async function markCheckoutReminderReadByProviderMessageId(providerMessageId: string, timestampIso: string): Promise<void> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE whatsapp_scheduled_messages SET status = 'READ', read_at = ?, updated_at = ?
     WHERE provider_message_id = ? AND status IN ('SENT', 'DELIVERED')`,
  ).bind(timestampIso, now, providerMessageId).run();
}

export async function markCheckoutReminderFailedByProviderMessageId(providerMessageId: string, reason: string, timestampIso: string): Promise<void> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE whatsapp_scheduled_messages SET status = 'FAILED', failure_reason = ?, failed_at = ?, updated_at = ?
     WHERE provider_message_id = ? AND status IN ('SENT', 'DELIVERED', 'READ')`,
  ).bind(reason.slice(0, 500), timestampIso, now, providerMessageId).run();
}

// ============ Admin panel (Mesajlar) için okuma + manuel aksiyonlar ============

// ORDER BY created_at DESC TEK BAŞINA yeterli değil: syncCheckoutReminderForReservation'daki iptal +
// yeni-satır adımları aynı JS event loop turunda, aynı milisaniye içinde created_at üretebilir -
// bu durumda created_at eşitliğinde SQLite'ın sıralaması TANIMSIZDIR (b-tree düzenine bağlı, "en son
// eklenen" garantisi vermez). rowid DESC ikinci sıralama anahtarı olarak eklenir - SQLite'ta INTEGER
// PRIMARY KEY olmayan her tabloda örtük, monoton artan bir rowid vardır, bu yüzden "en son eklenen
// satır" garantisi rowid ile KESİN sağlanır.
export async function getLatestCheckoutReminderForReservation(reservationId: string): Promise<WhatsappScheduledMessage | null> {
  const db = await database();
  await ensureTable(db);
  const row = await db.prepare(
    `SELECT * FROM whatsapp_scheduled_messages WHERE reservation_id = ? AND message_type = 'CHECKOUT_REMINDER'
     ORDER BY created_at DESC, rowid DESC LIMIT 1`,
  ).bind(reservationId).first<MessageRow>();
  return row ? mapRow(row) : null;
}

export async function listLatestCheckoutRemindersForReservations(reservationIds: string[]): Promise<Map<string, WhatsappScheduledMessage>> {
  if (reservationIds.length === 0) return new Map();
  const db = await database();
  await ensureTable(db);
  const placeholders = reservationIds.map(() => "?").join(",");
  const result = await db.prepare(
    `SELECT * FROM whatsapp_scheduled_messages WHERE message_type = 'CHECKOUT_REMINDER' AND reservation_id IN (${placeholders})
     ORDER BY created_at DESC, rowid DESC`,
  ).bind(...reservationIds).all<MessageRow>();
  const byReservation = new Map<string, WhatsappScheduledMessage>();
  for (const row of result.results ?? []) {
    // İlk (en yeni, created_at DESC) satır kazanır - her rezervasyon için tek "güncel" durum.
    if (!byReservation.has(row.reservation_id)) byReservation.set(row.reservation_id, mapRow(row));
  }
  return byReservation;
}

// Yalnız hâlâ SCHEDULED olan güncel satırın otomatik gönderim anahtarını değiştirir - SENT/FAILED
// gibi sonuçlanmış bir satıyı etkilemez (zaten UI de yalnız SCHEDULED durumunda bu aksiyonu sunar).
export async function setCheckoutReminderAutoEnabled(reservationId: string, enabled: boolean): Promise<WhatsappScheduledMessage | null> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE whatsapp_scheduled_messages SET auto_enabled = ?, updated_at = ?
     WHERE reservation_id = ? AND message_type = 'CHECKOUT_REMINDER' AND status = 'SCHEDULED'`,
  ).bind(enabled ? 1 : 0, now, reservationId).run();
  if ((result.meta.changes ?? 0) === 0) return null;
  return getLatestCheckoutReminderForReservation(reservationId);
}

// Yalnız GERÇEKTEN FAILED durumundaki bir kaydı yeniden SCHEDULED'a döndürür (scheduled_at = şimdi,
// bir sonraki cron tikinde tekrar denenir). SENT/DELIVERED/READ bir kayıt için no-op (0 satır
// etkilenir) - "yalnız gerçek FAILED kayıtlar yeniden denenebilir" kuralı burada uygulanır.
export async function retryFailedCheckoutReminder(reservationId: string): Promise<WhatsappScheduledMessage | null> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  const result = await db.prepare(
    `UPDATE whatsapp_scheduled_messages SET status = 'SCHEDULED', scheduled_at = ?, failure_reason = NULL, failed_at = NULL, updated_at = ?
     WHERE reservation_id = ? AND message_type = 'CHECKOUT_REMINDER' AND status = 'FAILED'`,
  ).bind(now, now, reservationId).run();
  if ((result.meta.changes ?? 0) === 0) return null;
  return getLatestCheckoutReminderForReservation(reservationId);
}

export { LOGICAL_CHECKOUT_TEMPLATE_NAME };
