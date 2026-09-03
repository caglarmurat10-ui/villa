import { requestPaytrToken } from "./token";

export interface PaytrConnectivityTestResult {
  ok: boolean;
  message: string;
  providerReason?: string;
  testedAt: string;
}

// PARA HAREKETİ YOK: yalnızca PayTR'in get-token (iFrame API Adım 1) uç noktasını, gerçek hiçbir
// rezervasyona/misafire bağlı olmayan SENTETİK veriyle çağırır. D1'e hiçbir şey YAZMAZ, dönen
// token'i asla kullanmaz/açmaz - PayTR bu adımda kart bilgisi almaz, tahsilat yapmaz. testMode
// HER ZAMAN true (global PAYTR_TEST_MODE ayarından bağımsız, savunma derinliği - bu fonksiyon
// PAYTR_TEST_MODE=false olsa bile asla gerçek moda geçmez). Amaç yalnız: merchant_id/key/salt
// gerçekten PayTR tarafından kabul ediliyor mu, hash hesaplaması doğru mu sorusuna canlı yanıt
// almak - admin panelinden elle tetiklenir, hiçbir zaman otomatik/zamanlanmış çalışmaz.
export async function testPaytrConnectivity(): Promise<PaytrConnectivityTestResult> {
  const testedAt = new Date().toISOString();
  const result = await requestPaytrToken({
    merchantOid: `TEST${Date.now()}`,
    userIp: "127.0.0.1",
    email: "baglanti-testi@safiradestan.com",
    amountMinor: 100,
    villaName: "Bağlantı Testi",
    paymentType: "deposit",
    noInstallment: true,
    maxInstallment: 0,
    userName: "Bağlantı Testi",
    userAddress: "Bağlantı Testi",
    userPhone: "05000000000",
    okUrl: "https://safiradestan.com/odeme/baglanti-testi/basarili",
    failUrl: "https://safiradestan.com/odeme/baglanti-testi/basarisiz",
    testMode: true,
  });

  if (result.ok) {
    return { ok: true, message: "PayTR bağlantısı doğrulandı — merchant kimlik bilgileri ve hash hesaplaması kabul edildi.", testedAt };
  }
  return {
    ok: false,
    message: result.error ?? "Bağlantı testi başarısız.",
    providerReason: result.providerReason,
    testedAt,
  };
}
