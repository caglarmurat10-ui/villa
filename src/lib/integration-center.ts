import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listOtaConnectionsStatus } from "./ota/status";
import type { OtaConnectionStatus } from "./ota/types";
import { getPaytrReadiness, type PaytrReadiness } from "./payments/paytr/config";
import { getGoogleVisibilitySnapshot, type GoogleVisibilitySnapshot } from "./google-visibility";
import { listMetaAccounts } from "./meta-store";
import { getSocialCronHeartbeat, type SocialCronHeartbeat } from "./social-cron-health";
import { getPublishStats, type PublishStats } from "./social-library-summary";

// Admin > Entegrasyonlar sayfasındaki tek-ekran "Entegrasyon Merkezi" için tek kaynak. Hiçbir yeni
// iş mantığı yok - yalnız zaten var olan, kendi başına test edilmiş fonksiyonları (OTA/PayTR/Google/
// Meta/cron/yayın istatistiği) paralel toplar. Google Ads/Meta Ads için kodda hiçbir entegrasyon
// olmadığından sabit WAITING_USER_ACTION döner - hiçbir zaman fabrikasyon bir "bağlı" durumu yok.
function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export interface MetaOrganicStatus {
  safiraInstagramConnected: boolean;
  safiraFacebookConnected: boolean;
  destanFacebookConnected: boolean;
  destanInstagramHardBlocked: true;
}

export interface IntegrationCenterSnapshot {
  workerVersionId: string | null;
  d1Healthy: boolean;
  otaConnections: OtaConnectionStatus[];
  lastOtaSyncAt: string | null;
  paytr: PaytrReadiness;
  google: GoogleVisibilitySnapshot;
  metaOrganic: MetaOrganicStatus;
  googleAdsState: "WAITING_USER_ACTION";
  metaAdsState: "WAITING_USER_ACTION";
  cronHeartbeat: SocialCronHeartbeat | null;
  cronHealthy: boolean;
  publishStats7: PublishStats;
}

const CRON_HEALTHY_WINDOW_MS = 45 * 60 * 1000; // 30 dk'lık en yavaş cron tetikleyicisinin (*/30) bir turunu kaçırsa bile makul tampon

async function checkD1Health(): Promise<boolean> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    await env.DB.prepare("SELECT 1").first();
    return true;
  } catch {
    return false;
  }
}

export async function getIntegrationCenterSnapshot(): Promise<IntegrationCenterSnapshot> {
  const { env } = await getCloudflareContext({ async: true });
  const workerVersionId = env.CF_VERSION_METADATA?.id ?? null;

  const [otaConnections, paytr, google, metaAccounts, cronHeartbeat, publishStats7, d1Healthy] = await Promise.all([
    listOtaConnectionsStatus(),
    getPaytrReadiness(),
    getGoogleVisibilitySnapshot(),
    listMetaAccounts(),
    getSocialCronHeartbeat(),
    getPublishStats(7, istanbulToday()),
    checkD1Health(),
  ]);

  const lastOtaSyncAt = otaConnections.reduce<string | null>((latest, connection) => {
    if (!connection.lastSyncedAt) return latest;
    if (!latest || connection.lastSyncedAt > latest) return connection.lastSyncedAt;
    return latest;
  }, null);

  const metaOrganic: MetaOrganicStatus = {
    safiraInstagramConnected: metaAccounts.some((a) => a.villa === "Safira" && a.platform === "Instagram"),
    safiraFacebookConnected: metaAccounts.some((a) => a.villa === "Safira" && a.platform === "Facebook"),
    destanFacebookConnected: metaAccounts.some((a) => a.villa === "Destan" && a.platform === "Facebook"),
    destanInstagramHardBlocked: true,
  };

  const cronHealthy = Boolean(cronHeartbeat && (Date.now() - Date.parse(cronHeartbeat.ranAt)) < CRON_HEALTHY_WINDOW_MS);

  return {
    workerVersionId,
    d1Healthy,
    otaConnections,
    lastOtaSyncAt,
    paytr,
    google,
    metaOrganic,
    googleAdsState: "WAITING_USER_ACTION",
    metaAdsState: "WAITING_USER_ACTION",
    cronHeartbeat,
    cronHealthy,
    publishStats7,
  };
}
