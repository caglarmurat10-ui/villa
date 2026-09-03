import { getCloudflareContext } from "@opennextjs/cloudflare";
import { hasGoogleConnection } from "../google-api";

// Google Ads API kullanmak icin UC TANE bagimsiz sey gerekir - hepsi ayri ayri kontrol edilir,
// hicbiri diğerinden cikarim yapilmaz: (1) OAuth (adwords scope, ayni Google OAuth client'i
// kullanir - bkz. oauth/start route'undaki google_ads scope'u), (2) developer token (Google Ads
// hesabindan alinir, Cloudflare secret), (3) customer ID (hangi Ads hesabina yazilacagi - Cloudflare
// secret). Hicbiri UYDURULMAZ; ucu de env/KV'de yoksa state bunu acikca yansitir.
export type GoogleAdsReadinessState =
  | "GOOGLE_ADS_WAITING_OAUTH"
  | "GOOGLE_ADS_WAITING_DEVELOPER_TOKEN"
  | "GOOGLE_ADS_WAITING_CUSTOMER_ID"
  | "GOOGLE_ADS_READY_READ_ONLY" // ucu de mevcut - hala hicbir live API cagrisi yapilmadi, yalniz on kosullar tamam
  | "GOOGLE_ADS_DRAFT_READY"; // taslak kutuphanesi her zaman kullanilabilir, bagimsiz durum

export interface GoogleAdsReadiness {
  state: GoogleAdsReadinessState;
  oauthConnected: boolean;
  developerTokenConfigured: boolean;
  customerIdConfigured: boolean;
  loginCustomerIdConfigured: boolean;
  missing: string[];
}

export async function getGoogleAdsReadiness(): Promise<GoogleAdsReadiness> {
  const { env } = await getCloudflareContext({ async: true });
  const [oauthConnected] = await Promise.all([hasGoogleConnection("google_ads")]);
  const developerTokenConfigured = Boolean(env.GOOGLE_ADS_DEVELOPER_TOKEN);
  const customerIdConfigured = Boolean(env.GOOGLE_ADS_CUSTOMER_ID);
  const loginCustomerIdConfigured = Boolean(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

  const missing: string[] = [];
  if (!oauthConnected) missing.push("Google Ads OAuth bağlantısı (scope=google_ads) tamamlanmalı");
  if (!developerTokenConfigured) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN Cloudflare secret olarak eklenmeli (Google Ads hesabından alınır)");
  if (!customerIdConfigured) missing.push("GOOGLE_ADS_CUSTOMER_ID Cloudflare secret olarak eklenmeli (hangi Ads hesabına yazılacağı)");
  if (customerIdConfigured && !loginCustomerIdConfigured) missing.push("GOOGLE_ADS_LOGIN_CUSTOMER_ID (yönetici hesabı üzerinden erişiliyorsa) opsiyonel ama önerilir");

  let state: GoogleAdsReadinessState;
  if (!oauthConnected) state = "GOOGLE_ADS_WAITING_OAUTH";
  else if (!developerTokenConfigured) state = "GOOGLE_ADS_WAITING_DEVELOPER_TOKEN";
  else if (!customerIdConfigured) state = "GOOGLE_ADS_WAITING_CUSTOMER_ID";
  else state = "GOOGLE_ADS_READY_READ_ONLY";

  return { state, oauthConnected, developerTokenConfigured, customerIdConfigured, loginCustomerIdConfigured, missing };
}
