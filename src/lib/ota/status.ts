import { getCloudflareContext } from "@opennextjs/cloudflare";
import { OTA_PLATFORMS, OTA_VILLAS, type OtaConnectionStatus } from "./types";

interface ConnectionRow {
  villa: string;
  platform: string;
  is_enabled: number;
  last_synced_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
}

interface BlockCountRow {
  villa: string;
  source: string;
  status: string;
  count: number;
}

// Admin > Entegrasyonlar ekranı ve GET /api/ota/connections tarafından paylaşılır - ham import
// URL'si burada asla döndürülmez (ota_connections tablosu zaten hiç içermiyor).
export async function listOtaConnectionsStatus(): Promise<OtaConnectionStatus[]> {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const [connections, blockCounts] = await Promise.all([
    db.prepare("SELECT villa, platform, is_enabled, last_synced_at, last_success_at, last_error FROM ota_connections").all<ConnectionRow>(),
    db.prepare("SELECT villa, source, status, COUNT(*) as count FROM external_blocks GROUP BY villa, source, status").all<BlockCountRow>(),
  ]);

  const byKey = new Map(connections.results.map((row) => [`${row.villa}:${row.platform}`, row]));

  function countFor(villa: string, source: string, status: string): number {
    return blockCounts.results.find((row) => row.villa === villa && row.source === source && row.status === status)?.count ?? 0;
  }

  const result: OtaConnectionStatus[] = [];
  for (const villa of OTA_VILLAS) {
    for (const platform of OTA_PLATFORMS) {
      const row = byKey.get(`${villa}:${platform}`);
      result.push({
        villa,
        platform,
        connected: Boolean(row?.is_enabled),
        lastSyncedAt: row?.last_synced_at ?? null,
        lastSuccessAt: row?.last_success_at ?? null,
        lastError: row?.last_error ?? null,
        activeBlockCount: countFor(villa, platform, "active"),
        conflictCount: countFor(villa, platform, "needs_review"),
      });
    }
  }
  return result;
}
