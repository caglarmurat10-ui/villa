import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PAYTR_TEST_MODE } from "../types";

export interface PaytrCredentials {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
}

export async function getPaytrCredentials(): Promise<PaytrCredentials | null> {
  const { env } = await getCloudflareContext({ async: true });
  const merchantId = env.PAYTR_MERCHANT_ID;
  const merchantKey = env.PAYTR_MERCHANT_KEY;
  const merchantSalt = env.PAYTR_MERCHANT_SALT;
  if (!merchantId || !merchantKey || !merchantSalt) return null;
  return { merchantId, merchantKey, merchantSalt };
}

export async function isPaytrConfigured(): Promise<boolean> {
  return (await getPaytrCredentials()) !== null;
}

export const PAYTR_CALLBACK_URL = "https://safiradestan.com/api/payments/paytr/callback";

export type PaytrReadinessState = "PAYTR_READY" | "PAYTR_TEST_MODE_ONLY" | "PAYTR_NOT_CONFIGURED";

export interface PaytrReadiness {
  state: PaytrReadinessState;
  configured: boolean;
  testMode: boolean;
  callbackUrl: string;
  // Koddan doğrulanamayan, PayTR merchant panelinde kullanıcının elle teyit etmesi gereken adımlar -
  // hiçbiri burada tahmin edilmez, yalnızca sabit bir kontrol listesi olarak sunulur.
  merchantPanelChecklist: string[];
}

// "PAYTR_READY" hiçbir zaman otomatik dönmez: canlıya geçiş (PAYTR_TEST_MODE=false) bilinçli bir
// kod değişikliği+deploy gerektirir (bkz. types.ts), bu yüzden test_mode açıkken en iyi ihtimalle
// PAYTR_TEST_MODE_ONLY - gerçek tahsilat teknik olarak mümkün değildir.
export async function getPaytrReadiness(): Promise<PaytrReadiness> {
  const configured = await isPaytrConfigured();
  const merchantPanelChecklist = [
    `Bildirim (callback) URL'si PayTR merchant panelinde kayıtlı olmalı: ${PAYTR_CALLBACK_URL}`,
    "Taksit limitleri (varsayılan üst sınır 6) merchant panelinden ilgili kart şemaları için açılmalı",
    "merchant_ok_url/merchant_fail_url domaini (safiradestan.com) panelde onaylı/whitelist'te olmalı",
    "Canlıya geçiş: hesabın kendisi panelde test'ten canlıya alınmalı (bu, koddaki PAYTR_TEST_MODE bayrağından ayrı bir adımdır)",
  ];

  if (!configured) {
    return { state: "PAYTR_NOT_CONFIGURED", configured, testMode: PAYTR_TEST_MODE, callbackUrl: PAYTR_CALLBACK_URL, merchantPanelChecklist };
  }
  return {
    state: PAYTR_TEST_MODE ? "PAYTR_TEST_MODE_ONLY" : "PAYTR_READY",
    configured,
    testMode: PAYTR_TEST_MODE,
    callbackUrl: PAYTR_CALLBACK_URL,
    merchantPanelChecklist,
  };
}
