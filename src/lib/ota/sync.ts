import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import type { Villa } from "@/lib/types";
import { OTA_PLATFORMS, OTA_VILLAS, type OtaPlatform } from "./types";
import { getImportUrl } from "./kv";
import { fetchIcsSafely, sanitizeErrorMessage } from "./security";
import { parseIcsEvents } from "./ics-parser";
import { logOtaAudit } from "./audit";
import { isAnomalousBlockDuration } from "./anomaly";

async function database(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

async function isConnectionEnabled(db: D1Database, villa: Villa, platform: OtaPlatform): Promise<boolean> {
  const row = await db.prepare(
    "SELECT is_enabled FROM ota_connections WHERE villa = ? AND platform = ?",
  ).bind(villa, platform).first<{ is_enabled: number }>();
  return Boolean(row?.is_enabled);
}

async function upsertConnectionResult(
  db: D1Database,
  villa: Villa,
  platform: OtaPlatform,
  result: { ok: true } | { ok: false; error: string },
): Promise<void> {
  const now = new Date().toISOString();
  if (result.ok) {
    await db.prepare(`
      UPDATE ota_connections SET last_synced_at = ?, last_success_at = ?, last_error = NULL, updated_at = ?
      WHERE villa = ? AND platform = ?
    `).bind(now, now, now, villa, platform).run();
  } else {
    await db.prepare(`
      UPDATE ota_connections SET last_synced_at = ?, last_error = ?, updated_at = ?
      WHERE villa = ? AND platform = ?
    `).bind(now, sanitizeErrorMessage(result.error), now, villa, platform).run();
  }
}

async function hasDirectReservationConflict(db: D1Database, villa: Villa, start: string, end: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT id FROM reservations WHERE villa = ? AND deleted_at IS NULL AND check_in < ? AND check_out > ? LIMIT 1
  `).bind(villa, end, start).first();
  return Boolean(row);
}

async function hasOtherSourceConflict(db: D1Database, villa: Villa, source: OtaPlatform, start: string, end: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT id FROM external_blocks
    WHERE villa = ? AND source != ? AND status IN ('active','needs_review') AND start_date < ? AND end_date > ?
    LIMIT 1
  `).bind(villa, source, end, start).first();
  return Boolean(row);
}

export interface SyncResult {
  ok: boolean;
  count?: number;
  error?: string;
}

// Tek bir villa+platform bağlantısını senkronize eder. Bağlantı D1'de is_enabled=0/yok VEYA
// OTA_PRIVATE'ta import URL'si tanımlı değilse HİÇ fetch denemez (sahte/dummy sync sonucu üretmez).
export async function syncOneConnection(villa: Villa, platform: OtaPlatform): Promise<SyncResult> {
  const db = await database();

  const enabled = await isConnectionEnabled(db, villa, platform);
  if (!enabled) {
    return { ok: false, error: "Bağlantı devre dışı veya yapılandırılmadı." };
  }

  const importUrl = await getImportUrl(villa, platform);
  if (!importUrl) {
    return { ok: false, error: "Import URL tanımlı değil." };
  }

  let icsText: string;
  try {
    icsText = await fetchIcsSafely(importUrl, platform);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await upsertConnectionResult(db, villa, platform, { ok: false, error: message });
    await logOtaAudit("ICAL_SYNC_FAILED", { villa, source: platform, error: sanitizeErrorMessage(message) });
    return { ok: false, error: sanitizeErrorMessage(message) };
  }

  const events = parseIcsEvents(icsText);
  const now = new Date().toISOString();
  const seenUids = new Set<string>();

  for (const event of events) {
    seenUids.add(event.uid);

    const existing = await db.prepare(`
      SELECT id, start_date, end_date, status FROM external_blocks WHERE villa = ? AND source = ? AND external_uid = ?
    `).bind(villa, platform, event.uid).first<{ id: string; start_date: string; end_date: string; status: string }>();

    const directConflict = await hasDirectReservationConflict(db, villa, event.startDate, event.endDate);
    const otherOtaConflict = await hasOtherSourceConflict(db, villa, platform, event.startDate, event.endDate);
    const anomalousDuration = isAnomalousBlockDuration(event.startDate, event.endDate);
    const nextStatus = directConflict || otherOtaConflict || anomalousDuration ? "needs_review" : "active";

    if (!existing) {
      await db.prepare(`
        INSERT INTO external_blocks (id, villa, source, external_uid, start_date, end_date, status, last_synced_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), villa, platform, event.uid, event.startDate, event.endDate, nextStatus, now, now, now).run();
      await logOtaAudit("EXTERNAL_BLOCK_CREATED", { villa, source: platform, startDate: event.startDate, endDate: event.endDate });
      if (anomalousDuration) {
        await logOtaAudit("ANOMALOUS_BLOCK_DETECTED", { villa, source: platform, startDate: event.startDate, endDate: event.endDate });
      } else if (nextStatus === "needs_review") {
        await logOtaAudit("BOOKING_CONFLICT_DETECTED", { villa, source: platform, startDate: event.startDate, endDate: event.endDate });
      }
    } else {
      const changed = existing.start_date !== event.startDate || existing.end_date !== event.endDate || existing.status !== nextStatus;
      if (changed) {
        await db.prepare(`
          UPDATE external_blocks SET start_date = ?, end_date = ?, status = ?, last_synced_at = ?, updated_at = ? WHERE id = ?
        `).bind(event.startDate, event.endDate, nextStatus, now, now, existing.id).run();
        await logOtaAudit("EXTERNAL_BLOCK_UPDATED", { villa, source: platform, startDate: event.startDate, endDate: event.endDate });
        if (anomalousDuration) {
          await logOtaAudit("ANOMALOUS_BLOCK_DETECTED", { villa, source: platform, startDate: event.startDate, endDate: event.endDate });
        } else if (nextStatus === "needs_review" && existing.status !== "needs_review") {
          await logOtaAudit("BOOKING_CONFLICT_DETECTED", { villa, source: platform, startDate: event.startDate, endDate: event.endDate });
        }
      } else {
        await db.prepare("UPDATE external_blocks SET last_synced_at = ? WHERE id = ?").bind(now, existing.id).run();
      }
    }
  }

  // Bir önceki sync'te aktif/needs_review olup yeni feed'de artık görünmeyen block'lar (misafir
  // iptal etmiş) - hard delete değil, status='removed' (denetim izi kalır).
  const staleRows = await db.prepare(`
    SELECT id, external_uid FROM external_blocks WHERE villa = ? AND source = ? AND status IN ('active','needs_review')
  `).bind(villa, platform).all<{ id: string; external_uid: string }>();

  for (const row of staleRows.results) {
    if (!seenUids.has(row.external_uid)) {
      await db.prepare("UPDATE external_blocks SET status = 'removed', updated_at = ? WHERE id = ?").bind(now, row.id).run();
      await logOtaAudit("EXTERNAL_BLOCK_REMOVED", { villa, source: platform });
    }
  }

  await upsertConnectionResult(db, villa, platform, { ok: true });
  await logOtaAudit("ICAL_SYNC_SUCCESS", { villa, source: platform, count: events.length });
  return { ok: true, count: events.length };
}

// Cron tarafından çağrılır - tek bir bağlantının hatası diğerlerini durdurmaz.
export async function runOtaSync(): Promise<void> {
  for (const villa of OTA_VILLAS) {
    for (const platform of OTA_PLATFORMS) {
      try {
        await syncOneConnection(villa, platform);
      } catch (error) {
        console.error(`[OTA sync] ${villa}/${platform} beklenmeyen hata:`, error instanceof Error ? error.message : error);
      }
    }
  }
}
