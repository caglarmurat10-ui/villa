import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

export interface BookingGuestDetails {
  email: string;
  address: string;
  identityNo: string;
}

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

async function ensureTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS booking_guest_details (
    inquiry_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    address TEXT NOT NULL,
    identity_no TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}

export async function upsertBookingGuestDetails(inquiryId: string, details: BookingGuestDetails): Promise<void> {
  const db = await database();
  await ensureTable(db);
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO booking_guest_details
    (inquiry_id, email, address, identity_no, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(inquiry_id) DO UPDATE SET
      email = excluded.email,
      address = excluded.address,
      identity_no = excluded.identity_no,
      updated_at = excluded.updated_at`)
    .bind(inquiryId, details.email, details.address, details.identityNo, now, now).run();
}

export async function getBookingGuestDetails(inquiryId: string): Promise<BookingGuestDetails | null> {
  const db = await database();
  await ensureTable(db);
  const row = await db.prepare(
    "SELECT email, address, identity_no FROM booking_guest_details WHERE inquiry_id = ?",
  ).bind(inquiryId).first<{ email: string; address: string; identity_no: string }>();
  return row ? { email: row.email, address: row.address, identityNo: row.identity_no } : null;
}
