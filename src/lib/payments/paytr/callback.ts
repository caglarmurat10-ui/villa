import { hmacSha256Base64 } from "../crypto";
import { getPaytrCredentials } from "./config";

export interface PaytrNotification {
  merchantOid: string;
  status: "success" | "failed";
  totalAmountMinor: number;
  hash: string;
  paymentType?: string;
  testMode: boolean;
  currency?: string;
  paymentAmountMinor?: number;
  failedReasonCode?: string;
  failedReasonMsg?: string;
}

export function parseNotificationForm(form: URLSearchParams): PaytrNotification | null {
  const merchantOid = form.get("merchant_oid");
  const status = form.get("status");
  const totalAmount = form.get("total_amount");
  const hash = form.get("hash");
  if (!merchantOid || !hash || (status !== "success" && status !== "failed") || !totalAmount) return null;

  const totalAmountMinor = Number.parseInt(totalAmount, 10);
  if (!Number.isFinite(totalAmountMinor)) return null;

  return {
    merchantOid,
    status,
    totalAmountMinor,
    hash,
    paymentType: form.get("payment_type") ?? undefined,
    testMode: form.get("test_mode") === "1",
    currency: form.get("currency") ?? undefined,
    paymentAmountMinor: form.get("payment_amount") ? Number.parseInt(form.get("payment_amount") ?? "", 10) : undefined,
    failedReasonCode: form.get("failed_reason_code") ?? undefined,
    failedReasonMsg: form.get("failed_reason_msg") ?? undefined,
  };
}

// PayTR resmi dokümanındaki notification hash doğrulama algoritması BİREBİR:
// hash = base64(HMAC-SHA256(merchant_oid + merchant_salt + status + total_amount, key=merchant_key))
// Bu değer, PayTR'ın gönderdiği ham total_amount ÜZERİNDEN hesaplanır (bizim istediğimiz tutar
// değil) - taksit/vade farkıyla bizim requested_amount'tan yüksek olabilir, bu normaldir.
export async function verifyNotificationHash(notification: PaytrNotification): Promise<boolean> {
  const credentials = await getPaytrCredentials();
  if (!credentials) return false;
  const hashStr = `${notification.merchantOid}${credentials.merchantSalt}${notification.status}${notification.totalAmountMinor}`;
  const expected = await hmacSha256Base64(credentials.merchantKey, hashStr);
  return expected === notification.hash;
}
