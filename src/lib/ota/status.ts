import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
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

// health (yeşil/sarı/kırmızı) etiketinin sayısal karşılığı - aynı zaman eşiklerinden lineer
// enterpolasyonla türetilir, ayrı bir kaynak/yeni bir eşik seti değil. conflictCount/anomalyCount
// var olduğunda puan düşürülür (0'a inmez - "senkron çalışıyor ama incelenmesi gereken şey var"
// ile "senkron tamamen kırık" arasındaki fark korunur).
function computeHealthScore(connected: boolean, lastSuccessAt: string | null, conflictCount: number, anomalyCount: number): number {
  if (!connected) return 0;
  if (!lastSuccessAt) return 0;
  const minutesAgo = (Date.now() - Date.parse(lastSuccessAt)) / 60000;
  let base: number;
  if (minutesAgo <= HEALTH_GREEN_MINUTES) base = 100;
  else if (minutesAgo <= HEALTH_YELLOW_MINUTES) {
    const span = HEALTH_YELLOW_MINUTES - HEALTH_GREEN_MINUTES;
    const progress = (minutesAgo - HEALTH_GREEN_MINUTES) / span;
    base = Math.round(100 - progress * 40); // 100 -> 60 boyunca sari bolgede
  } else base = Math.max(0, Math.round(60 - Math.min(60, (minutesAgo - HEALTH_YELLOW_MINUTES) / 60)));

  const penalty = Math.min(30, conflictCount * 5 + anomalyCount * 10);
  return Math.max(0, Math.min(100, base - penalty));
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

interface AuditPayloadRow {
  entity_id: string; // audit_log.entity_id = villa (logOtaAudit ile yazilir)
  payload: string; // JSON: { villa, source, ... } - platform burada
}

const ANOMALY_WINDOW_DAYS = 30;

// audit_log.entity_id yalniz villa'yi tasir (logOtaAudit'in imzasi geregi) - platform ayrimi icin
// payload JSON'u parse edilir (satir sayisi dogal olarak kucuk: 30 gunluk anomali tespiti).
async function countAnomaliesByVillaPlatform(db: D1Database): Promise<Map<string, number>> {
  const since = new Date(Date.now() - ANOMALY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.prepare(
    "SELECT entity_id, payload FROM audit_log WHERE action = 'ANOMALOUS_BLOCK_DETECTED' AND created_at >= ?",
  ).bind(since).all<AuditPayloadRow>();
  const counts = new Map<string, number>();
  for (const row of result.results) {
    try {
      const payload = JSON.parse(row.payload) as { source?: string };
      const key = `${row.entity_id}:${payload.source ?? "unknown"}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    } catch {
      // bozuk payload - sessizce atla, sayaç için kritik değil
    }
  }
  return counts;
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
        anomalyCount: 0,
        healthScore: 0,
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

    const [connections, blockCounts, anomalyCounts] = await Promise.all([
      db.prepare("SELECT villa, platform, is_enabled, last_synced_at, last_success_at, last_error FROM ota_connections").all<ConnectionRow>(),
      db.prepare("SELECT villa, source, status, COUNT(*) as count FROM external_blocks GROUP BY villa, source, status").all<BlockCountRow>(),
      countAnomaliesByVillaPlatform(db),
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
        const conflictCount = countFor(villa, platform, "needs_review");
        const anomalyCount = anomalyCounts.get(`${villa}:${platform}`) ?? 0;
        result.push({
          villa,
          platform,
          connected,
          lastSyncedAt: row?.last_synced_at ?? null,
          lastSuccessAt,
          lastError: row?.last_error ?? null,
          activeBlockCount: countFor(villa, platform, "active"),
          conflictCount,
          anomalyCount,
          healthScore: computeHealthScore(connected, lastSuccessAt, conflictCount, anomalyCount),
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
