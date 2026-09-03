import { getCloudflareContext } from "@opennextjs/cloudflare";

// Mevcut Meta OAuth akışı (Instagram/Facebook organik bağlantılar) ads_management/ads_read izni
// İSTEMİYOR - o token'ları Ads API için kullanmak REDDEDİLİR. Gerçek bir Business Manager/ad_account
// erişimi için ayrı bir yetkilendirme adımı gerekir (Facebook Login for Business + Business asset
// seçici) - bu kod tabanında henüz o akış YOK, bu yüzden state hiçbir zaman kendiliğinden READY
// olmaz. Organik Destan Instagram HARD BLOCK'una bu modül hiç dokunmaz/etkilemez.
export type MetaAdsReadinessState =
  | "META_ADS_WAITING_PERMISSION"
  | "META_ADS_WAITING_AD_ACCOUNT"
  | "META_ADS_READY_READ_ONLY"
  | "META_ADS_DRAFT_READY";

export interface MetaAdsReadiness {
  state: MetaAdsReadinessState;
  adAccountConfigured: boolean;
  missing: string[];
}

export async function getMetaAdsReadiness(): Promise<MetaAdsReadiness> {
  const { env } = await getCloudflareContext({ async: true });
  const adAccountConfigured = Boolean(env.META_ADS_AD_ACCOUNT_ID);

  const missing: string[] = [
    "Business Manager'da ads_management veya ads_read izni ayrıca verilmeli (mevcut organik IG/FB bağlantısı bu izni içermez, tamamen ayrı bir yetkilendirmedir)",
  ];
  if (!adAccountConfigured) missing.push("META_ADS_AD_ACCOUNT_ID Cloudflare secret olarak eklenmeli (hangi ad_account'a yazılacağı)");

  // Ads izni doğrulayacak bir OAuth akışı henüz kodda yok - bu yüzden "izin verildi" asla
  // otomatik varsayılmaz, her zaman WAITING_PERMISSION (ad_account bile ayarlansa).
  const state: MetaAdsReadinessState = adAccountConfigured ? "META_ADS_WAITING_PERMISSION" : "META_ADS_WAITING_AD_ACCOUNT";

  return { state, adAccountConfigured, missing };
}
