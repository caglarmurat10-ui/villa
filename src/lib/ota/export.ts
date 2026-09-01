import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "@/lib/types";
import type { OtaPlatform } from "./types";

export interface ExportEvent {
  uid: string;
  startDate: string;
  endDate: string;
}

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

// excludeSource: bu feed'in gönderileceği platform - o platformdan zaten import edilmiş block'lar
// tekrar aynı platforma geri gönderilmez (loop prevention). Yalnız UID/tarih döner - misafir
// adı/telefon/e-posta/fiyat/not hiçbir zaman bu sorgulara dahil değil.
export async function buildExportEvents(villa: Villa, excludeSource: OtaPlatform): Promise<ExportEvent[]> {
  const db = await database();

  const reservations = await db.prepare(
    "SELECT id, check_in, check_out FROM reservations WHERE villa = ? AND deleted_at IS NULL",
  ).bind(villa).all<{ id: string; check_in: string; check_out: string }>();

  const blocks = await db.prepare(`
    SELECT id, start_date, end_date FROM external_blocks
    WHERE villa = ? AND source != ? AND status IN ('active','needs_review')
  `).bind(villa, excludeSource).all<{ id: string; start_date: string; end_date: string }>();

  const events: ExportEvent[] = [];
  for (const row of reservations.results) {
    events.push({ uid: `direct-${row.id}@safiradestan.com`, startDate: row.check_in, endDate: row.check_out });
  }
  for (const row of blocks.results) {
    events.push({ uid: `block-${row.id}@safiradestan.com`, startDate: row.start_date, endDate: row.end_date });
  }
  return events;
}
