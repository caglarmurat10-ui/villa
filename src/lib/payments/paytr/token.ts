import { hmacSha256Base64 } from "../crypto";
import { getPaytrCredentials } from "./config";
import type { PaymentType } from "../types";

const GET_TOKEN_URL = "https://www.paytr.com/odeme/api/get-token";
const TIMEOUT_LIMIT_MINUTES = 30; // PayTR'ın kendi dokümante ettiği varsayılan - uydurulmadı.

export interface TokenRequestInput {
  merchantOid: string;
  userIp: string;
  email: string;
  amountMinor: number;
  villaName: string;
  paymentType: PaymentType;
  noInstallment: boolean;
  maxInstallment: number;
  userName: string;
  userPhone: string;
  okUrl: string;
  failUrl: string;
  testMode: boolean;
}

export interface TokenResult {
  ok: boolean;
  token?: string;
  iframeUrl?: string;
  expiresAt?: string;
  error?: string;
}

// UTF-8 güvenli base64 - Türkçe karakterler içeren basket adları için düz btoa() yeterli değil.
function base64EncodeUtf8(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function basketItemLabel(paymentType: PaymentType, villaName: string): string {
  if (paymentType === "deposit") return `${villaName} - On Odeme (%20)`;
  if (paymentType === "full_payment") return `${villaName} - Tam Odeme`;
  return `${villaName} - Kalan Bakiye`;
}

// PayTR resmi dokümanındaki hash algoritması BİREBİR - alan sırası değiştirilemez:
// hash_str = merchant_id+user_ip+merchant_oid+email+payment_amount+user_basket+no_installment+max_installment+currency+test_mode
// paytr_token = base64(HMAC-SHA256(hash_str + merchant_salt, key=merchant_key))
export async function requestPaytrToken(input: TokenRequestInput): Promise<TokenResult> {
  const credentials = await getPaytrCredentials();
  if (!credentials) {
    return { ok: false, error: "Ödeme sistemi henüz yapılandırılmadı." };
  }

  const paymentAmount = String(input.amountMinor);
  const noInstallment = input.noInstallment ? "1" : "0";
  const maxInstallment = String(input.maxInstallment);
  const testMode = input.testMode ? "1" : "0";
  const currency = "TL";

  // Basket kalem şeması (isim/fiyat-string/adet üçlüsü) PayTR'ın yaygın dokümante örnek yapısı -
  // canlıya geçmeden önce gerçek sandbox yanıtıyla son kez doğrulanmalı (bkz. progress.md notu).
  const basketRaw = JSON.stringify([[basketItemLabel(input.paymentType, input.villaName), (input.amountMinor / 100).toFixed(2), 1]]);
  const userBasket = base64EncodeUtf8(basketRaw);

  const hashStr = `${credentials.merchantId}${input.userIp}${input.merchantOid}${input.email}${paymentAmount}${userBasket}${noInstallment}${maxInstallment}${currency}${testMode}`;
  const paytrToken = await hmacSha256Base64(credentials.merchantKey, hashStr + credentials.merchantSalt);

  const body = new URLSearchParams({
    merchant_id: credentials.merchantId,
    user_ip: input.userIp,
    merchant_oid: input.merchantOid,
    email: input.email,
    payment_amount: paymentAmount,
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: input.testMode ? "1" : "0",
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: input.userName || "Misafir",
    user_address: "Patara, Kas, Antalya",
    user_phone: input.userPhone || "05000000000",
    merchant_ok_url: input.okUrl,
    merchant_fail_url: input.failUrl,
    timeout_limit: String(TIMEOUT_LIMIT_MINUTES),
    currency,
    test_mode: testMode,
    lang: "tr",
  });

  let response: Response;
  try {
    response = await fetch(GET_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    return { ok: false, error: "Ödeme sağlayıcısına bağlanılamadı." };
  }

  const data = await response.json().catch(() => null) as { status?: string; token?: string; reason?: string } | null;
  if (!data || data.status !== "success" || !data.token) {
    return { ok: false, error: "Ödeme oturumu başlatılamadı." };
  }

  const expiresAt = new Date(Date.now() + TIMEOUT_LIMIT_MINUTES * 60 * 1000).toISOString();
  return {
    ok: true,
    token: data.token,
    iframeUrl: `https://www.paytr.com/odeme/guvenli/${data.token}`,
    expiresAt,
  };
}
