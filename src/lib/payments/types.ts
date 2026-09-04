import type { Villa } from "@/lib/types";

// Provider-independent model - yalnız PayTR bu turda uygulanıyor ama şema/tipler başka bir
// provider'a bağlı değil.
export type PaymentProvider = "paytr";
export type PaymentType = "deposit" | "full_payment" | "balance_payment";
export type PaymentStatus = "created" | "pending" | "paid" | "failed" | "cancelled" | "refunded" | "partial_refund";

export interface Payment {
  id: string;
  reservationId: string;
  provider: PaymentProvider;
  merchantOid: string;
  paymentType: PaymentType;
  status: PaymentStatus;
  currency: "TRY";
  // reservation_total: rezervasyonun canonical fiyatı (oluşturma anında snapshot). requested_amount:
  // PayTR'dan istediğimiz tutar (deposit ya da full). provider_customer_total: PayTR'ın notification'da
  // bildirdiği gerçek tahsilat (taksit/vade farkıyla requested_amount'tan yüksek olabilir - reservation
  // fiyatını ASLA değiştirmez). provider_fee/merchant_net: PayTR bunları güvenilir şekilde vermiyor,
  // tahmin edilmez, NULL kalır.
  reservationTotalMinor: number;
  requestedAmountMinor: number;
  providerCustomerTotalMinor: number | null;
  providerFeeMinor: number | null;
  merchantNetMinor: number | null;
  // guest_email/PayTR token BİLEREK modelde yok - kod artık bunları D1'e hiç yazmıyor (gerekli
  // değilse PII/session verisi saklanmaz). guest_email/token kolonları D1 şemasında hâlâ var
  // (0012'den, nullable) ama unused - riskli bir migration'la kaldırılmadı, yalnız kullanılmıyor.
  noInstallment: boolean;
  maxInstallment: number;
  tokenExpiresAt: string | null;
  testMode: boolean;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  failedAt: string | null;
  villa: Villa;
  checkIn: string;
  checkOut: string;
}

// PayTR panelinde kullanıcının kendisinin ayarladığı gerçek üst sınır - tahmin edilmiş bir sayı
// değil (bkz. AŞAMA raporları). Deposit her zaman tek çekim.
export const FULL_PAYMENT_MAX_INSTALLMENT = 6;
export const DEPOSIT_PERCENTAGE = 20; // reservation-policy.ts'teki POLICY_SUMMARY.deposit ("%20") ile senkron olmalı.

// Canlı tahsilat açık. Public self-service akışında test_mode=0 ödeme ancak D1 tarih hold'u başarıyla
// oluşturulduktan sonra doğar; checkout hold'u doğrular/uzatır ve başarılı PayTR callback'i aynı
// transaction içinde gerçek rezervasyona dönüştürür. Merchant credentials yine yalnız secret'tır.
export const PAYTR_TEST_MODE = false;

// Lazy-expiry için token_expires_at üzerine eklenen tampon süre - PayTR'ın kendi retry davranışı
// (~1 dakikada bir, doğrulanmış OK gelene kadar) tam sınırda gelen gerçek bir callback'le
// yarışmamak için. Gerçek bir "cron" değil, yalnızca okuma anında uygulanan bir kontrol.
export const EXPIRY_GRACE_MINUTES = 5;
