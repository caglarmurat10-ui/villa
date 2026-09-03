import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listOtaConnectionsStatus } from "./ota/status";
import type { OtaConnectionStatus } from "./ota/types";
import { getPaytrReadiness, type PaytrReadiness } from "./payments/paytr/config";
import { getGoogleVisibilitySnapshot, type GoogleVisibilitySnapshot } from "./google-visibility";
import { listMetaAccounts } from "./meta-store";
import { getSocialCronHeartbeat, type SocialCronHeartbeat } from "./social-cron-health";
import { getPublishStats, type PublishStats } from "./social-library-summary";
import { getGoogleAdsReadiness, type GoogleAdsReadiness } from "./google-ads/readiness";
import { getMetaAdsReadiness, type MetaAdsReadiness } from "./meta-ads/readiness";
import { getInstallmentCampaignReadiness, type InstallmentCampaignReadiness } from "./payments/installment-campaign";

// Admin > Entegrasyonlar sayfasındaki tek-ekran "Entegrasyon Merkezi" için tek kaynak. Hiçbir yeni
// iş mantığı yok - yalnız zaten var olan, kendi başına test edilmiş fonksiyonları (OTA/PayTR/Google/
// Meta/cron/yayın istatistiği) paralel toplar. Google Ads/Meta Ads asla otomatik "bağlı" görünmez -
// getGoogleAdsReadiness/getMetaAdsReadiness her koşulu (OAuth/developer token/customer ID/ad account)
// ayrı ayrı kontrol eder, hiçbiri diğerinden çıkarım yapılmaz.
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
  installmentCampaign: InstallmentCampaignReadiness;
  google: GoogleVisibilitySnapshot;
  metaOrganic: MetaOrganicStatus;
  googleAds: GoogleAdsReadiness;
  metaAds: MetaAdsReadiness;
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

  const [otaConnections, paytr, installmentCampaign, google, metaAccounts, cronHeartbeat, publishStats7, d1Healthy, googleAds, metaAds] = await Promise.all([
    listOtaConnectionsStatus(),
    getPaytrReadiness(),
    getInstallmentCampaignReadiness(),
    getGoogleVisibilitySnapshot(),
    listMetaAccounts(),
    getSocialCronHeartbeat(),
    getPublishStats(7, istanbulToday()),
    checkD1Health(),
    getGoogleAdsReadiness(),
    getMetaAdsReadiness(),
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
    installmentCampaign,
    google,
    metaOrganic,
    googleAds,
    metaAds,
    cronHeartbeat,
    cronHealthy,
    publishStats7,
  };
}
