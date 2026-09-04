import { hmacSha256Base64 } from "../crypto";
import { getPaytrCredentials } from "./config";
import type { PaymentType } from "../types";

const GET_TOKEN_URL = "https://www.paytr.com/odeme/api/get-token";
const TIMEOUT_LIMIT_MINUTES = 30; // PayTR'ın kendi dokümante ettiği varsayılan - uydurulmadı.
const FETCH_TIMEOUT_MS = 20_000; // PayTR'ın kendi resmi entegrasyon örneklerindeki bağlantı süresi.

export interface TokenRequestInput {
  merchantOid: string;
  userIp: string;
  email: string;
  amountMinor: number;
  villaName: string;
  paymentType: PaymentType;
  noInstallment: boolean;
  maxInstallment: number;
  // Gerçek müşteri bilgisi - sahte/varsayılan değer ASLA kabul edilmez, çağıran taraf (checkout
  // route) bunları zod ile zorunlu kılar. "Misafir"/"05000000000"/sabit adres gibi fallback YOK.
  userName: string;
  userAddress: string;
  userPhone: string;
  okUrl: string;
  failUrl: string;
  testMode: boolean;
}

// Token'ın kendisi bilerek dönüş tipinde yok - D1'e hiç yazılmıyor (bkz. AŞAMA raporu), yalnız
// iframe URL'sinin bir parçası olarak kullanılıp atılıyor.
export interface TokenResult {
  ok: boolean;
  iframeUrl?: string;
  error?: string;
  // PayTR'ın kendi döndürdüğü ham "reason" alanı - secret/PII DEĞİL, yalnız admin/D1 last_error
  // için (bkz. checkout route). Müşteriye gösterilen `error` her zaman jenerik kalır.
  providerReason?: string;
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
  if (!input.userName.trim() || !input.userAddress.trim() || !input.userPhone.trim()) {
    // Sahte/varsayılan PII ile token isteği ASLA yapılmaz - çağıran taraf zaten zod ile bunu
    // zorunlu kılıyor, bu ikinci bir savunma katmanı.
    return { ok: false, error: "Gerekli müşteri bilgileri eksik." };
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
    // PayTR resmi dokümanı entegrasyon aşamasında debug_on=1 bırakılmasını öneriyor. Bu yalnız
    // başarısız token isteğinin nedenini JSON `reason` alanında döndürür; test_mode'ı değiştirmez
    // ve tek başına tahsilat oluşturmaz. İlk başarılı canlı iframe doğrulamasından sonra 0'a çekilecek.
    debug_on: "1",
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: input.userName,
    user_address: input.userAddress,
    user_phone: input.userPhone,
    merchant_ok_url: input.okUrl,
    merchant_fail_url: input.failUrl,
    timeout_limit: String(TIMEOUT_LIMIT_MINUTES),
    currency,
    test_mode: testMode,
    lang: "tr",
    // iframe_v2/iframe_v2_dark hash girdisine dahil değil (resmi algoritma yalnız yukarıdaki 10
    // alanı kullanır) - PayTR'ın güncel arayüzünü seçmek için eklenen ayrı, hash-dışı parametreler.
    iframe_v2: "1",
    iframe_v2_dark: "0",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(GET_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });
  } catch {
    // Timeout/abort dahil - hata mesajı jenerik, secret/PII asla loglanmaz.
    return { ok: false, error: "Ödeme sağlayıcısına bağlanılamadı." };
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => null) as { status?: string; token?: string; reason?: string } | null;
  if (!data || data.status !== "success" || !data.token) {
    return { ok: false, error: "Ödeme oturumu başlatılamadı.", providerReason: data?.reason?.slice(0, 200) };
  }

  return { ok: true, iframeUrl: `https://www.paytr.com/odeme/guvenli/${data.token}` };
}
