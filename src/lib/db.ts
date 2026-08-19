import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { PriceRange, Reservation, Villa, VillaLocations } from "./types";
import type { ReservationInput } from "./schema";

type ReservationRow = {
  id: string;
  villa: Villa;
  guest_name: string;
  phone: string;
  check_in: string;
  check_out: string;
  channel: Reservation["channel"];
  nightly_rate: number;
  total_amount: number;
  paid_amount: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

type PriceRangeRow = {
  id: string;
  villa: Villa;
  start_date: string;
  end_date: string;
  nightly_rate: number;
};

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

function mapRow(row: ReservationRow): Reservation {
  return {
    id: row.id,
    villa: row.villa,
    guestName: row.guest_name,
    phone: row.phone,
    checkIn: row.check_in,
    checkOut: row.check_out,
    channel: row.channel,
    nightlyRate: row.nightly_rate,
    totalAmount: row.total_amount,
    paidAmount: row.paid_amount,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findReservation(id: string): Promise<Reservation | null> {
  const db = await database();
  const row = await db.prepare("SELECT * FROM reservations WHERE id = ? AND deleted_at IS NULL").bind(id).first<ReservationRow>();
  return row ? mapRow(row) : null;
}

export async function checkDatabase(): Promise<void> {
  const db = await database();
  await db.prepare("SELECT 1").first();
}

export async function listReservations(): Promise<Reservation[]> {
  const db = await database();
  const result = await db.prepare("SELECT * FROM reservations WHERE deleted_at IS NULL ORDER BY check_in ASC").all<ReservationRow>();
  return result.results.map(mapRow);
}

export async function createReservation(input: ReservationInput): Promise<Reservation> {
  const db = await database();
  const overlap = await db.prepare(`
    SELECT id FROM reservations
    WHERE villa = ? AND deleted_at IS NULL AND check_in < ? AND check_out > ? LIMIT 1
  `).bind(input.villa, input.checkOut, input.checkIn).first();
  if (overlap) throw new Error("Bu tarihlerde villa için başka bir rezervasyon var.");

  const quote = await calculatePrice(input.villa, input.checkIn, input.checkOut);
  const now = new Date().toISOString();
  const reservation: Reservation = {
    id: crypto.randomUUID(),
    ...input,
    nightlyRate: quote.averageRate,
    totalAmount: quote.total,
    createdAt: now,
    updatedAt: now,
  };

  await db.batch([
    db.prepare(`INSERT INTO reservations
      (id, villa, guest_name, phone, check_in, check_out, channel, nightly_rate, total_amount, paid_amount, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(reservation.id, reservation.villa, reservation.guestName, reservation.phone,
        reservation.checkIn, reservation.checkOut, reservation.channel, reservation.nightlyRate,
        reservation.totalAmount, reservation.paidAmount, reservation.notes,
        reservation.createdAt, reservation.updatedAt),
    db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'CREATE', ?, ?)")
      .bind(reservation.id, JSON.stringify(reservation), now),
  ]);
  return reservation;
}

export async function getCommissionRate(): Promise<number> {
  const db = await database();
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'commission_rate'").first<{ value: string }>();
  return Number(row?.value ?? 10);
}

export async function setCommissionRate(rate: number): Promise<number> {
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error("Komisyon 0 ile 100 arasında olmalı.");
  const db = await database();
  await db.prepare("INSERT INTO settings (key, value) VALUES ('commission_rate', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(String(rate)).run();
  return rate;
}

export async function getVillaLocations(): Promise<VillaLocations> {
  const db = await database();
  const result = await db.prepare("SELECT key, value FROM settings WHERE key IN ('location_safira', 'location_destan')")
    .all<{ key: string; value: string }>();
  const values = new Map(result.results.map((row) => [row.key, row.value]));
  return {
    Safira: values.get("location_safira") ?? "",
    Destan: values.get("location_destan") ?? "",
  };
}

export async function setVillaLocations(locations: VillaLocations): Promise<VillaLocations> {
  const db = await database();
  await db.batch([
    db.prepare("INSERT INTO settings (key, value) VALUES ('location_safira', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(locations.Safira),
    db.prepare("INSERT INTO settings (key, value) VALUES ('location_destan', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(locations.Destan),
  ]);
  return locations;
}

export async function listPriceRanges(): Promise<PriceRange[]> {
  const db = await database();
  const result = await db.prepare("SELECT id, villa, start_date, end_date, nightly_rate FROM price_ranges ORDER BY villa, start_date").all<PriceRangeRow>();
  return result.results.map((row) => ({
    id: row.id,
    villa: row.villa,
    startDate: row.start_date,
    endDate: row.end_date,
    nightlyRate: row.nightly_rate,
  }));
}

export async function addPriceRange(input: Omit<PriceRange, "id">): Promise<PriceRange> {
  const db = await database();
  const overlap = await db.prepare("SELECT id FROM price_ranges WHERE villa = ? AND start_date <= ? AND end_date >= ? LIMIT 1")
    .bind(input.villa, input.endDate, input.startDate).first();
  if (overlap) throw new Error("Bu villa için çakışan bir fiyat dönemi var.");
  const range = { id: crypto.randomUUID(), ...input };
  await db.prepare("INSERT INTO price_ranges (id, villa, start_date, end_date, nightly_rate, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(range.id, range.villa, range.startDate, range.endDate, range.nightlyRate, new Date().toISOString()).run();
  return range;
}

export async function deletePriceRange(id: string): Promise<boolean> {
  const db = await database();
  const result = await db.prepare("DELETE FROM price_ranges WHERE id = ?").bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function calculatePrice(villa: Villa, checkIn: string, checkOut: string) {
  const ranges = (await listPriceRanges()).filter((range) => range.villa === villa);
  let total = 0;
  let nights = 0;
  for (let cursor = new Date(`${checkIn}T00:00:00Z`); cursor < new Date(`${checkOut}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    const range = ranges.find((item) => item.startDate <= date && item.endDate >= date);
    if (!range) throw new Error(`${date} tarihi için ${villa} fiyatı tanımlı değil.`);
    total += range.nightlyRate;
    nights += 1;
  }
  if (!nights) throw new Error("Geçerli bir konaklama tarihi seçin.");
  return { total, nights, averageRate: total / nights };
}

export async function softDeleteReservation(id: string): Promise<boolean> {
  const db = await database();
  const now = new Date().toISOString();
  const existing = await findReservation(id);
  if (!existing) return false;
  await db.batch([
    db.prepare("UPDATE reservations SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL").bind(now, now, id),
    db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'DELETE', '{}', ?)").bind(id, now),
  ]);
  return true;
}

export async function updateReservation(id: string, input: ReservationInput): Promise<Reservation> {
  const db = await database();
  const current = await findReservation(id);
  if (!current) throw new Error("Rezervasyon bulunamadı.");
  const overlap = await db.prepare(`
    SELECT id FROM reservations
    WHERE villa = ? AND id != ? AND deleted_at IS NULL AND check_in < ? AND check_out > ? LIMIT 1
  `).bind(input.villa, id, input.checkOut, input.checkIn).first();
  if (overlap) throw new Error("Bu tarihlerde villa için başka bir rezervasyon var.");
  const quote = await calculatePrice(input.villa, input.checkIn, input.checkOut);
  if (input.paidAmount > quote.total) throw new Error("Alınan ödeme toplam tutardan büyük olamaz.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE reservations SET villa=?, guest_name=?, phone=?, check_in=?, check_out=?, channel=?, nightly_rate=?, total_amount=?, paid_amount=?, notes=?, updated_at=? WHERE id=?`)
      .bind(input.villa, input.guestName, input.phone, input.checkIn, input.checkOut,
        input.channel, quote.averageRate, quote.total, input.paidAmount, input.notes, now, id),
    db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'UPDATE', ?, ?)")
      .bind(id, JSON.stringify(input), now),
  ]);
  return (await findReservation(id))!;
}

export async function updatePayment(id: string, paidAmount: number): Promise<Reservation> {
  const db = await database();
  const row = await db.prepare("SELECT total_amount FROM reservations WHERE id = ? AND deleted_at IS NULL")
    .bind(id).first<{ total_amount: number }>();
  if (!row) throw new Error("Rezervasyon bulunamadı.");
  if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > row.total_amount) {
    throw new Error("Ödeme 0 ile toplam tutar arasında olmalı.");
  }
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE reservations SET paid_amount = ?, updated_at = ? WHERE id = ?").bind(paidAmount, now, id),
    db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'PAYMENT', ?, ?)")
      .bind(id, JSON.stringify({ paidAmount }), now),
  ]);
  return (await findReservation(id))!;
}

export async function getAuditLog() {
  const db = await database();
  const result = await db.prepare("SELECT entity_id AS entityId, action, payload, created_at AS createdAt FROM audit_log ORDER BY id DESC LIMIT 500").all();
  return result.results;
}
