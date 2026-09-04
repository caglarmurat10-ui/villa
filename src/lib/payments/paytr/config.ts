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

// VERIFIED yalnız gerçek koddan/canlı probe'dan kanıt olduğunda kullanılır - hiçbir madde kendi
// kendine PASS olmaz. MANUAL_ONLY: bu kodun hiçbir yolu yok, yalnız PayTR merchant panelinden
// veya admin panelindeki "Bağlantı Testini Çalıştır" butonuyla (canlı, ekranda) doğrulanabilir.
export type PaytrChecklistStatus = "VERIFIED" | "NOT_VERIFIED" | "MANUAL_ONLY";

export interface PaytrChecklistItem {
  label: string;
  status: PaytrChecklistStatus;
  note: string;
}

export interface PaytrReadiness {
  state: PaytrReadinessState;
  configured: boolean;
  testMode: boolean;
  callbackUrl: string;
  merchantPanelChecklist: PaytrChecklistItem[];
}

// PAYTR_READY burada yalnız iki kod-seviyesi koşulu ifade eder: merchant secret'ları tanımlı ve
// PAYTR_TEST_MODE=false. Merchant hesabının gerçekten aktif olduğu, callback/domain/taksit ayarlarının
// doğru olduğu anlamına GELMEZ; onlar aşağıdaki MANUAL_ONLY checklist veya canlı bağlantı testiyle
// ayrıca doğrulanır.
export async function getPaytrReadiness(): Promise<PaytrReadiness> {
  const configured = await isPaytrConfigured();
  const merchantPanelChecklist: PaytrChecklistItem[] = [
    {
      label: "Merchant panel callback URL doğrulandı",
      status: "MANUAL_ONLY",
      note: `Kod bu URL'yi kullanıyor: ${PAYTR_CALLBACK_URL} — panelde kayıtlı olduğu yalnız PayTR merchant hesabından teyit edilebilir.`,
    },
    {
      label: "Domain onayı doğrulandı",
      status: "MANUAL_ONLY",
      note: "merchant_ok_url/merchant_fail_url domaini (safiradestan.com) panelde onaylı/whitelist'te olmalı — koddan doğrulanamaz.",
    },
    {
      label: "Taksit ayarları doğrulandı",
      status: "MANUAL_ONLY",
      note: "Kod en fazla 6 taksit gönderiyor (full_payment) — bu limitin ilgili kart şemaları için panelde açık olduğu koddan doğrulanamaz.",
    },
    {
      label: "Merchant hesabı aktif",
      status: "MANUAL_ONLY",
      note: "Yalnız admin panelindeki 'Bağlantı Testini Çalıştır' butonuyla (canlı PayTR API yanıtı) veya merchant panelinden doğrulanabilir.",
    },
    {
      label: "Test ödeme başarıyla doğrulandı",
      status: "MANUAL_ONLY",
      note: "Bu sayfa yalnız bağlantı/kimlik doğrulamasını test eder (para hareketi yok) — uçtan uca bir test ödemesi PayTR'ın kendi sandbox akışında elle yapılmalı.",
    },
    {
      label: "Canlı moda kullanıcı tarafından ayrıca izin verildi",
      status: configured && !PAYTR_TEST_MODE ? "VERIFIED" : "NOT_VERIFIED",
      note: PAYTR_TEST_MODE
        ? "Kodda PAYTR_TEST_MODE=true — canlıya geçiş, kullanıcının onayıyla ayrı bir bilinçli kod değişikliği+deploy gerektirir."
        : "Kodda PAYTR_TEST_MODE=false — canlı mod kod seviyesinde açık.",
    },
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
