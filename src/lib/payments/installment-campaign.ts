import { getCloudflareContext } from "@opennextjs/cloudflare";
import { FULL_PAYMENT_MAX_INSTALLMENT } from "./types";

// "Peşin Fiyatına 6 Taksit" kampanyasının PUBLIC ACTIVE olabilmesi icin ALTI ayri kosul var (Faz 4
// bolum F/U) - hicbiri digerinden cikarim yapilmaz, hicbiri kendi kendine VERIFIED olmaz.
export type InstallmentChecklistStatus = "VERIFIED" | "NOT_VERIFIED" | "MANUAL_ONLY";

export interface InstallmentChecklistItem {
  label: string;
  status: InstallmentChecklistStatus;
  note: string;
}

export type InstallmentCampaignState = "INSTALLMENT_CAMPAIGN_VERIFIED" | "INSTALLMENT_CAMPAIGN_NOT_VERIFIED";

export interface InstallmentCampaignReadiness {
  state: InstallmentCampaignState;
  maxInstallment: number;
  checklist: InstallmentChecklistItem[];
}

// Merchant panelde "Peşin Fiyatına Taksit" ayarının doğrulandığı, domain/callback onayının ve
// hesabın bu taksit seçeneğini desteklediğinin KULLANICI tarafından elle teyit edildiği anlamına
// gelir - koddan asla otomatik doğrulanamayacak 3 madde (1/2/6, bkz. checklist) için TEK kapı.
// PAYTR_TEST_MODE ile aynı desen: canlıya/ACTIVE'e geçiş, kullanıcının açık onayıyla yapılan AYRI
// bir kod değişikliği + deploy gerektirir - bir admin panel toggle'ı YANLIŞLIKLA bunu açamaz.
export const INSTALLMENT_CAMPAIGN_MERCHANT_VERIFIED = false;

// NOT (2027 fiyat kararı, "3 veya 6 taksit" public copy'si): PayTR'ın iframe/API'sinin ara taksit
// sayılarını (2,3,4,5) da mı sunduğu, yoksa max_installment=6 ile 2-6 arası TÜM seçeneklerin mi
// otomatik açıldığı - bu, gerçek merchant panel/API dokümantasyonu incelenip canlı test edilmeden
// buradan doğrulanamaz/uydurulamaz. Public banner ve booking widget'taki "3 veya 6 taksit" copy'si
// bu belirsizlikten BAĞIMSIZ olarak doğrudur (müşteri toplamı hangi taksit sayısını seçerse seçsin
// değişmez) - yalnız PayTR'ın müşteriye TAM OLARAK 3 ve 6'yı mı, yoksa daha geniş bir aralığı mı
// sunacağı ayrı, doğrulanmamış bir konu. Merchant verification aşamasında ayrıca kontrol edilmeli.

interface RealFullPaymentRow {
  requested_amount_minor: number;
  provider_customer_total_minor: number | null;
  max_installment: number;
  no_installment: number;
}

// D1'de test_mode=0, payment_type='full_payment', status='paid' olan GERÇEK bir odemede PayTR'ın
// bildirdiği musteri toplaminin (provider_customer_total_minor) bizim istedigimiz tutarla
// (requested_amount_minor = reservation_total) birebir esit oldugunu arar - "pesin fiyatina"
// iddiasinin GERCEK KANITI budur. Hicbir odeme yoksa veya tutarlar uyusmuyorsa NOT_VERIFIED kalir.
async function findMatchingRealPaymentEvidence(): Promise<{ found: boolean; matched: boolean }> {
  const { env } = await getCloudflareContext({ async: true });
  const rows = await env.DB.prepare(
    "SELECT requested_amount_minor, provider_customer_total_minor, max_installment, no_installment FROM payments WHERE test_mode = 0 AND payment_type = 'full_payment' AND status = 'paid'",
  ).all<RealFullPaymentRow>();

  if (rows.results.length === 0) return { found: false, matched: false };
  const matched = rows.results.some((row) =>
    row.provider_customer_total_minor !== null &&
    row.provider_customer_total_minor === row.requested_amount_minor &&
    row.max_installment === FULL_PAYMENT_MAX_INSTALLMENT &&
    row.no_installment === 0,
  );
  return { found: true, matched };
}

export async function getInstallmentCampaignReadiness(): Promise<InstallmentCampaignReadiness> {
  const evidence = await findMatchingRealPaymentEvidence();

  const checklist: InstallmentChecklistItem[] = [
    {
      label: "PayTR merchant panel 'Peşin Fiyatına Taksit' ayarı doğrulandı",
      status: INSTALLMENT_CAMPAIGN_MERCHANT_VERIFIED ? "VERIFIED" : "MANUAL_ONLY",
      note: "Yalnız PayTR merchant panelinden elle doğrulanabilir - koddan otomatik doğrulanamaz.",
    },
    {
      label: "Domain/callback onayı doğrulandı",
      status: INSTALLMENT_CAMPAIGN_MERCHANT_VERIFIED ? "VERIFIED" : "MANUAL_ONLY",
      note: "PayTR merchant panelinden elle doğrulanabilir.",
    },
    {
      label: "Test ödemesinde müşteri toplamı = rezervasyon toplamı kanıtlandı",
      status: evidence.found && evidence.matched ? "VERIFIED" : "NOT_VERIFIED",
      note: evidence.found
        ? (evidence.matched ? "Gerçek bir ödemede PayTR müşteri toplamı, istenen tutarla birebir eşleşti." : "Gerçek ödeme bulundu ama tutarlar EŞLEŞMEDİ (vade farkı olabilir) - kampanya doğrulanamaz.")
        : "Henüz gerçek (test_mode=0), 6 taksitli, tamamlanmış bir ödeme yok - kanıt bekleniyor.",
    },
    {
      label: `max_installment gerçekten ${FULL_PAYMENT_MAX_INSTALLMENT}`,
      status: FULL_PAYMENT_MAX_INSTALLMENT === 6 ? "VERIFIED" : "NOT_VERIFIED",
      note: "Kod sabiti (types.ts) doğrudan kontrol edildi.",
    },
    {
      label: "full_payment için no_installment = false",
      status: "VERIFIED",
      note: "Checkout route full_payment için noInstallment=false gönderiyor (kod kontrol edildi).",
    },
    {
      label: "Merchant hesabı bu taksit seçeneğini destekliyor",
      status: INSTALLMENT_CAMPAIGN_MERCHANT_VERIFIED ? "VERIFIED" : "MANUAL_ONLY",
      note: "Yalnız PayTR merchant panelinden elle doğrulanabilir.",
    },
  ];

  const allVerified = checklist.every((item) => item.status === "VERIFIED");
  return {
    state: allVerified ? "INSTALLMENT_CAMPAIGN_VERIFIED" : "INSTALLMENT_CAMPAIGN_NOT_VERIFIED",
    maxInstallment: FULL_PAYMENT_MAX_INSTALLMENT,
    checklist,
  };
}
