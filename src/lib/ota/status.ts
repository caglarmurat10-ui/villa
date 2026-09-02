import { getCloudflareContext } from "@opennextjs/cloudflare";
import { OTA_PLATFORMS, OTA_VILLAS, type OtaConnectionStatus, type OtaSyncHealth } from "./types";

// Takvim senkronu gerçek-zamanlı bir API değil - bizim cron'umuz 30 dk'da bir, Airbnb'nin kendi
// import yenilemesi ise (kendi Help Center'ına göre) ~3 saatte bir çalışıyor. Eşikler buna göre:
// yeşil = son 90 dk (bizim cron'un birkaç turunu kaçırsa bile makul tampon), sarı = son 6 saat
// (Airbnb'nin kendi gecikmesi + tampon), kırmızı = daha eski veya hiç başarılı olmamış.
const HEALTH_GREEN_MINUTES = 90;
const HEALTH_YELLOW_MINUTES = 6 * 60;

function computeHealth(connected: boolean, lastSuccessAt: string | null): OtaSyncHealth {
  if (!connected) return "pending";
  if (!lastSuccessAt) return "red";
  const minutesAgo = (Date.now() - Date.parse(lastSuccessAt)) / 60000;
  if (minutesAgo <= HEALTH_GREEN_MINUTES) return "green";
  if (minutesAgo <= HEALTH_YELLOW_MINUTES) return "yellow";
  return "red";
}

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

function emptyStatuses(errorMessage: string): OtaConnectionStatus[] {
  const result: OtaConnectionStatus[] = [];
  for (const villa of OTA_VILLAS) {
    for (const platform of OTA_PLATFORMS) {
      result.push({
        villa,
        platform,
        connected: false,
        lastSyncedAt: null,
        lastSuccessAt: null,
        lastError: errorMessage,
        activeBlockCount: 0,
        conflictCount: 0,
        health: "pending",
      });
    }
  }
  return result;
}

// Admin > Entegrasyonlar ekranı ve GET /api/ota/connections tarafından paylaşılır - ham import
// URL'si burada asla döndürülmez (ota_connections tablosu zaten hiç içermiyor). Bir D1/migration
// sorunu varsa sayfayı düşürmek yerine dört bağlantıyı pending olarak gösterip hata bilgisini taşır.
export async function listOtaConnectionsStatus(): Promise<OtaConnectionStatus[]> {
  try {
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
        const connected = Boolean(row?.is_enabled);
        const lastSuccessAt = row?.last_success_at ?? null;
        result.push({
          villa,
          platform,
          connected,
          lastSyncedAt: row?.last_synced_at ?? null,
          lastSuccessAt,
          lastError: row?.last_error ?? null,
          activeBlockCount: countFor(villa, platform, "active"),
          conflictCount: countFor(villa, platform, "needs_review"),
          health: computeHealth(connected, lastSuccessAt),
        });
      }
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 180) : "unknown";
    console.error(`[OTA Status] D1 read failed: ${message}`);
    return emptyStatuses("OTA durum verisi okunamadı; D1 migration/bağlantısını kontrol edin.");
  }
}
