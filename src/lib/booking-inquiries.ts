import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "./types";

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
  source: "web";
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
  source: "web";
  created_at: string;
  updated_at: string;
};

type PriceRow = {
  start_date: string;
  end_date: string;
  nightly_rate: number;
};

export class BookingInquiryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingInquiryConflictError";
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS booking_inquiries_status_idx ON booking_inquiries (status, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS booking_inquiries_phone_idx ON booking_inquiries (phone_normalized, created_at DESC)"),
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

async function quoteForDates(db: D1Database, villa: Villa, checkIn: string, checkOut: string) {
  const ranges = await db.prepare(`SELECT start_date, end_date, nightly_rate
    FROM price_ranges WHERE villa = ? ORDER BY start_date ASC`).bind(villa).all<PriceRow>();
  let total = 0;
  let nights = 0;
  let complete = true;
  const end = new Date(`${checkOut}T00:00:00Z`);

  for (let cursor = new Date(`${checkIn}T00:00:00Z`); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    const range = ranges.results.find((item) => item.start_date <= date && item.end_date >= date);
    if (!range) complete = false;
    else total += range.nightly_rate;
    nights += 1;
  }

  return { total: complete ? total : null, nights };
}

export async function createBookingInquiry(input: BookingInquiryInput) {
  const db = await database();
  await ensureBookingInquiriesTable(db);

  const occupied = await db.prepare(`SELECT id FROM reservations
    WHERE villa = ? AND deleted_at IS NULL AND check_in < ? AND check_out > ? LIMIT 1`)
    .bind(input.villa, input.checkOut, input.checkIn).first();
  if (occupied) throw new BookingInquiryConflictError("Seçtiğiniz tarihler artık dolu görünüyor. Lütfen başka tarih seçin.");

  const phoneNormalized = normalizeBookingPhone(input.phone);
  const duplicateAfter = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const duplicate = await db.prepare(`SELECT * FROM booking_inquiries
    WHERE villa = ? AND check_in = ? AND check_out = ? AND phone_normalized = ?
      AND status != 'Kapatıldı' AND created_at >= ?
    ORDER BY created_at DESC LIMIT 1`)
    .bind(input.villa, input.checkIn, input.checkOut, phoneNormalized, duplicateAfter)
    .first<BookingInquiryRow>();
  if (duplicate) return { inquiry: mapRow(duplicate), duplicate: true };

  const quote = await quoteForDates(db, input.villa, input.checkIn, input.checkOut);
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
    source: "web",
    createdAt: now,
    updatedAt: now,
  };

  await db.batch([
    db.prepare(`INSERT INTO booking_inquiries
      (id, villa, guest_name, phone, phone_normalized, check_in, check_out, guest_count, note,
       quoted_total, quoted_nights, status, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(inquiry.id, inquiry.villa, inquiry.guestName, inquiry.phone, inquiry.phoneNormalized,
        inquiry.checkIn, inquiry.checkOut, inquiry.guestCount, inquiry.note, inquiry.quotedTotal,
        inquiry.quotedNights, inquiry.status, inquiry.source, inquiry.createdAt, inquiry.updatedAt),
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
  const now = new Date().toISOString();
  const result = await db.prepare("UPDATE booking_inquiries SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, now, id).run();
  if ((result.meta.changes ?? 0) === 0) return null;
  await db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'INQUIRY_STATUS', ?, ?)")
    .bind(id, JSON.stringify({ status }), now).run();
  const row = await db.prepare("SELECT * FROM booking_inquiries WHERE id = ?").bind(id).first<BookingInquiryRow>();
  return row ? mapRow(row) : null;
}
