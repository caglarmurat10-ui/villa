import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Villa } from "@/lib/types";
import type { ExternalBlockSource } from "./types";

export type OtaAuditAction =
  | "ICAL_FEED_CONNECTED"
  | "ICAL_SYNC_SUCCESS"
  | "ICAL_SYNC_FAILED"
  | "EXTERNAL_BLOCK_CREATED"
  | "EXTERNAL_BLOCK_UPDATED"
  | "EXTERNAL_BLOCK_REMOVED"
  | "BOOKING_CONFLICT_DETECTED";

interface OtaAuditPayload {
  villa: Villa;
  source?: ExternalBlockSource;
  count?: number;
  startDate?: string;
  endDate?: string;
  error?: string;
}

// Yalnız güvenli metadata: villa/kaynak/sayı/tarih-aralığı/hata-özeti. Secret, token veya ham ICS
// URL'si asla bu fonksiyona geçirilmemeli (çağıranlar sanitizeErrorMessage kullanmalı).
export async function logOtaAudit(action: OtaAuditAction, payload: OtaAuditPayload): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  await env.DB.prepare(
    "INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, ?, ?, ?)",
  ).bind(payload.villa, action, JSON.stringify(payload), new Date().toISOString()).run();
}
