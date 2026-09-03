import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "./types";
import { computePriceQuote, type PriceRangeInput } from "./price-engine";

export type BookingInquiryStatus = "Yeni" | "İletişime geçildi" | "Kapatıldı";

export interface BookingInquiry {
  id: string;
  villa: Villa;
  guestName: string;
  phone: string;
  phoneNormalized: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  note: string;
  quotedTotal: number | null;
  quotedNights: number;
  status: BookingInquiryStatus;
  source: string;
  convertedReservationId: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingInquiryInput {
  villa: Villa;
  guestName: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  note: string;
  source?: string;
}

type BookingInquiryRow = {
  id: string;
  villa: Villa;
  guest_name: string;
  phone: string;
  phone_normalized: string;
  check_in: string;
  check_out: string;
  guest_count: number;
  note: string;
  quoted_total: number | null;
  quoted_nights: number;
  status: BookingInquiryStatus;
  source: string;
  converted_reservation_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
};

type PriceRow = {
  start_date: string;
  end_date: string;
  nightly_rate: number;
  base_nights: number | null;
  base_price_minor: number | null;
  minimum_nights: number | null;
};

export class BookingInquiryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingInquiryConflictError";
  }
}

export class BookingInquiryConversionError extends Error {
  readonly status: number;

  constructor(message: string, status = 409) {
    super(message);
    this.name = "BookingInquiryConversionError";
    this.status = status;
  }
}

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

async function ensureBookingInquiriesTable(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS booking_inquiries (
      id TEXT PRIMARY KEY,
      villa TEXT NOT NULL CHECK (villa IN ('Safira', 'Destan')),
      guest_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      phone_normalized TEXT NOT NULL,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      guest_count INTEGER NOT NULL DEFAULT 2 CHECK (guest_count BETWEEN 1 AND 12),
      note TEXT NOT NULL DEFAULT '',
      quoted_total REAL,
      quoted_nights INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Yeni' CHECK (status IN ('Yeni', 'İletişime geçildi', 'Kapatıldı')),
      source TEXT NOT NULL DEFAULT 'web',
      converted_reservation_id TEXT,
      converted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS booking_inquiries_status_idx ON booking_inquiries (status, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS booking_inquiries_phone_idx ON booking_inquiries (phone_normalized, created_at DESC)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS booking_inquiries_conversion_reservation_idx ON booking_inquiries (converted_reservation_id)"),
  ]);
}

function mapRow(row: BookingInquiryRow): BookingInquiry {
  return {
    id: row.id,
    villa: row.villa,
    guestName: row.guest_name,
    phone: row.phone,
    phoneNormalized: row.phone_normalized,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guestCount: row.guest_count,
    note: row.note,
    quotedTotal: row.quoted_total,
    quotedNights: row.quoted_nights,
    status: row.status,
    source: row.source,
    convertedReservationId: row.converted_reservation_id,
    convertedAt: row.converted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeBookingPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) digits = `90${digits}`;
  else if (digits.length === 11 && digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  return digits;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

async function fetchPriceRanges(db: D1Database, villa: Villa): Promise<PriceRangeInput[]> {
  const result = await db.prepare(`SELECT start_date, end_date, nightly_rate, base_nights, base_price_minor, minimum_nights
    FROM price_ranges WHERE villa = ? ORDER BY start_date ASC`).bind(villa).all<PriceRow>();
  return result.results.map((row) => ({
    startDate: row.start_date,
    endDate: row.end_date,
    nightlyRate: row.nightly_rate,
    basePriceMinor: row.base_price_minor ?? undefined,
    baseNights: row.base_nights ?? undefined,
    minimumNights: row.minimum_nights ?? undefined,
  }));
}

// Faz 5 son denetim düzeltmesi - public booking inquiry artık TEK canonical kaynağı
// (price-engine.ts computePriceQuote) kullanır, kendi nightly_rate x gece matematiğini YENİDEN
// ÜRETMEZ. enforceMinimumStay parametresi çağırana bırakılır: public müşteri yolu (true, varsayılan)
// vs admin dönüşüm yolu (false, bkz. convertBookingInquiryToReservation) - "public müşteri yolu ile
// admin personel yolu birbirine karıştırılmasın" kuralı burada, TEK fonksiyonun iki farklı BİLİNÇLİ
// çağrı şekliyle korunur (iki ayrı, birbirinden sapabilecek fiyat matematiği YOK).
async function canonicalQuote(db: D1Database, villa: Villa, checkIn: string, checkOut: string, enforceMinimumStay: boolean) {
  const ranges = await fetchPriceRanges(db, villa);
  const quote = computePriceQuote(ranges, checkIn, checkOut, { enforceMinimumStay });
  if (quote.status === "ok") return { total: quote.total, nights: quote.nights, minStayRejected: false as const, minimumNights: null };
  if (quote.status === "min_stay") return { total: null, nights: nightsBetween(checkIn, checkOut), minStayRejected: true as const, minimumNights: quote.minimumNights };
  // "gap" veya "invalid_range" - eski davranışla aynı: fiyat henüz tanımsız, inquiry yine de
  // oluşturulabilir (quotedTotal null, ekip manuel iletişime geçer) - bu bir REJECTION değil.
  return { total: null, nights: nightsBetween(checkIn, checkOut), minStayRejected: false as const, minimumNights: null };
}

// Faz 5 son denetim düzeltmesi - public inquiry artık yalnız reservations tablosunu değil,
// GERÇEKTEN doğrulanmış (status='active') OTA bloklarını da çakışma sayar - public takvimin
// (listBlockedRanges, ota/availability.ts) gösterdiğiyle BİREBİR aynı davranış. needs_review
// (doğrulanmamış/şüpheli) bloklar public müşteriyi ASLA bloklamaz - yalnız admin takviminde görünür.
async function hasActiveOtaConflict(db: D1Database, villa: Villa, checkIn: string, checkOut: string): Promise<boolean> {
  const row = await db.prepare(`SELECT id FROM external_blocks
    WHERE villa = ? AND status = 'active' AND start_date < ? AND end_date > ? LIMIT 1`)
    .bind(villa, checkOut, checkIn).first();
  return Boolean(row);
}

async function findBookingInquiry(db: D1Database, id: string) {
  const row = await db.prepare("SELECT * FROM booking_inquiries WHERE id = ?").bind(id).first<BookingInquiryRow>();
  return row ? mapRow(row) : null;
}

export async function createBookingInquiry(input: BookingInquiryInput) {
  const db = await database();
  await ensureBookingInquiriesTable(db);

  const occupied = await db.prepare(`SELECT id FROM reservations
    WHERE villa = ? AND deleted_at IS NULL AND check_in < ? AND check_out > ? LIMIT 1`)
    .bind(input.villa, input.checkOut, input.checkIn).first();
  if (occupied) throw new BookingInquiryConflictError("Seçtiğiniz tarihler artık dolu görünüyor. Lütfen başka tarih seçin.");

  if (await hasActiveOtaConflict(db, input.villa, input.checkIn, input.checkOut)) {
    throw new BookingInquiryConflictError("Seçtiğiniz tarihler artık dolu görünüyor. Lütfen başka tarih seçin.");
  }

  const phoneNormalized = normalizeBookingPhone(input.phone);
  const duplicateAfter = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const duplicate = await db.prepare(`SELECT * FROM booking_inquiries
    WHERE villa = ? AND check_in = ? AND check_out = ? AND phone_normalized = ?
      AND status != 'Kapatıldı' AND created_at >= ?
    ORDER BY created_at DESC LIMIT 1`)
    .bind(input.villa, input.checkIn, input.checkOut, phoneNormalized, duplicateAfter)
    .first<BookingInquiryRow>();
  if (duplicate) return { inquiry: mapRow(duplicate), duplicate: true };

  const quote = await canonicalQuote(db, input.villa, input.checkIn, input.checkOut, true);
  if (quote.minStayRejected) {
    throw new BookingInquiryConflictError(`Bu dönem için minimum konaklama süresi ${quote.minimumNights} gecedir.`);
  }
  const now = new Date().toISOString();
  const inquiry: BookingInquiry = {
    id: crypto.randomUUID(),
    villa: input.villa,
    guestName: input.guestName,
    phone: input.phone,
    phoneNormalized,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    guestCount: input.guestCount,
    note: input.note,
    quotedTotal: quote.total,
    quotedNights: quote.nights,
    status: "Yeni",
    source: input.source?.trim() || "web",
    convertedReservationId: null,
    convertedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.batch([
    db.prepare(`INSERT INTO booking_inquiries
      (id, villa, guest_name, phone, phone_normalized, check_in, check_out, guest_count, note,
       quoted_total, quoted_nights, status, source, converted_reservation_id, converted_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(inquiry.id, inquiry.villa, inquiry.guestName, inquiry.phone, inquiry.phoneNormalized,
        inquiry.checkIn, inquiry.checkOut, inquiry.guestCount, inquiry.note, inquiry.quotedTotal,
        inquiry.quotedNights, inquiry.status, inquiry.source, inquiry.convertedReservationId,
        inquiry.convertedAt, inquiry.createdAt, inquiry.updatedAt),
    db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'INQUIRY_CREATE', ?, ?)")
      .bind(inquiry.id, JSON.stringify({ villa: inquiry.villa, checkIn: inquiry.checkIn, checkOut: inquiry.checkOut }), now),
  ]);

  return { inquiry, duplicate: false };
}

export async function listBookingInquiries(): Promise<BookingInquiry[]> {
  const db = await database();
  await ensureBookingInquiriesTable(db);
  const result = await db.prepare(`SELECT * FROM booking_inquiries
    ORDER BY CASE status WHEN 'Yeni' THEN 0 WHEN 'İletişime geçildi' THEN 1 ELSE 2 END,
      created_at DESC`).all<BookingInquiryRow>();
  return result.results.map(mapRow);
}

export async function updateBookingInquiryStatus(id: string, status: BookingInquiryStatus): Promise<BookingInquiry | null> {
  const db = await database();
  await ensureBookingInquiriesTable(db);
  const current = await findBookingInquiry(db, id);
  if (!current) return null;
  if (current.convertedReservationId && status !== "Kapatıldı") {
    throw new BookingInquiryConversionError("Rezervasyona dönüştürülmüş talep yeniden açılamaz.");
  }

  const now = new Date().toISOString();
  const result = await db.prepare("UPDATE booking_inquiries SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, now, id).run();
  if ((result.meta.changes ?? 0) === 0) return null;
  await db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'INQUIRY_STATUS', ?, ?)")
    .bind(id, JSON.stringify({ status }), now).run();
  return findBookingInquiry(db, id);
}

export async function convertBookingInquiryToReservation(id: string) {
  const db = await database();
  await ensureBookingInquiriesTable(db);
  const inquiry = await findBookingInquiry(db, id);
  if (!inquiry) return null;

  if (inquiry.convertedReservationId) {
    return { inquiry, reservationId: inquiry.convertedReservationId, alreadyConverted: true };
  }
  if (inquiry.status === "Kapatıldı") {
    throw new BookingInquiryConversionError("Kapatılmış talep rezervasyona dönüştürülemez. Önce talebi yeniden açın.");
  }

  // enforceMinimumStay:false - admin bilinçli olarak eski/kısa bir inquiry'i dönüştürebilir (personel
  // override), AMA fiyat her zaman canonical engine'den gelir, ASLA override edilmez (bkz. dosya başı
  // canonicalQuote notu).
  const quote = await canonicalQuote(db, inquiry.villa, inquiry.checkIn, inquiry.checkOut, false);
  if (!quote.nights || quote.total === null) {
    throw new BookingInquiryConversionError("Bu tarihler için fiyat dönemi eksik. Önce fiyatları tamamlayın.");
  }

  const occupied = await db.prepare(`SELECT id FROM reservations
    WHERE villa = ? AND deleted_at IS NULL AND check_in < ? AND check_out > ? LIMIT 1`)
    .bind(inquiry.villa, inquiry.checkOut, inquiry.checkIn).first();
  if (occupied) {
    throw new BookingInquiryConversionError("Bu tarihler artık dolu. Talep rezervasyona dönüştürülmedi.");
  }

  // Dönüşüm anında son bir kez GERÇEK (active) OTA çakışması da kontrol edilir - talep
  // oluşturulduğundan beri Airbnb/Booking senkronu yeni bir aktif blok eklemiş olabilir.
  if (await hasActiveOtaConflict(db, inquiry.villa, inquiry.checkIn, inquiry.checkOut)) {
    throw new BookingInquiryConversionError("Bu tarihler artık başka bir kanalda (Airbnb/Booking) dolu görünüyor. Talep rezervasyona dönüştürülmedi.");
  }

  const reservationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const averageRate = quote.total / quote.nights;
  const notes = [
    `Web rezervasyon talebinden oluşturuldu · ${inquiry.guestCount} kişi`,
    inquiry.note ? `Misafir notu: ${inquiry.note}` : "",
  ].filter(Boolean).join("\n");

  const reservationPayload = {
    id: reservationId,
    villa: inquiry.villa,
    guestName: inquiry.guestName,
    phone: inquiry.phone,
    checkIn: inquiry.checkIn,
    checkOut: inquiry.checkOut,
    channel: "Doğrudan",
    nightlyRate: averageRate,
    totalAmount: quote.total,
    paidAmount: 0,
    notes,
    createdAt: now,
    updatedAt: now,
  };

  const results = await db.batch([
    db.prepare(`INSERT INTO reservations
      (id, villa, guest_name, phone, check_in, check_out, channel, nightly_rate, total_amount, paid_amount, notes, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, 'Doğrudan', ?, ?, 0, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM booking_inquiries
        WHERE id = ? AND converted_reservation_id IS NULL AND status != 'Kapatıldı'
      )
      AND NOT EXISTS (
        SELECT 1 FROM reservations
        WHERE villa = ? AND deleted_at IS NULL AND check_in < ? AND check_out > ?
      )`)
      .bind(reservationId, inquiry.villa, inquiry.guestName, inquiry.phone, inquiry.checkIn, inquiry.checkOut,
        averageRate, quote.total, notes, now, now, inquiry.id, inquiry.villa, inquiry.checkOut, inquiry.checkIn),
    db.prepare(`UPDATE booking_inquiries
      SET status = 'Kapatıldı', converted_reservation_id = ?, converted_at = ?, updated_at = ?
      WHERE id = ? AND converted_reservation_id IS NULL
        AND EXISTS (SELECT 1 FROM reservations WHERE id = ?)`)
      .bind(reservationId, now, now, inquiry.id, reservationId),
    db.prepare(`INSERT INTO audit_log (entity_id, action, payload, created_at)
      SELECT ?, 'CREATE', ?, ?
      WHERE EXISTS (SELECT 1 FROM reservations WHERE id = ?)`)
      .bind(reservationId, JSON.stringify(reservationPayload), now, reservationId),
    db.prepare(`INSERT INTO audit_log (entity_id, action, payload, created_at)
      SELECT ?, 'INQUIRY_CONVERT', ?, ?
      WHERE EXISTS (SELECT 1 FROM reservations WHERE id = ?)`)
      .bind(inquiry.id, JSON.stringify({ reservationId }), now, reservationId),
  ]);

  if ((results[0]?.meta.changes ?? 0) === 0 || (results[1]?.meta.changes ?? 0) === 0) {
    const latest = await findBookingInquiry(db, id);
    if (latest?.convertedReservationId) {
      return { inquiry: latest, reservationId: latest.convertedReservationId, alreadyConverted: true };
    }
    throw new BookingInquiryConversionError("Talep dönüştürülürken tarihler başka bir rezervasyonla çakıştı.");
  }

  const updated = await findBookingInquiry(db, id);
  if (!updated) throw new BookingInquiryConversionError("Talep dönüştürüldü ancak sonuç kaydı okunamadı.", 500);
  return { inquiry: updated, reservationId, alreadyConverted: false };
}
