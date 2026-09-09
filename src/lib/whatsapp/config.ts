import { getCloudflareContext } from "@opennextjs/cloudflare";

// PayTR ile AYNI desen (bkz. src/lib/payments/paytr/config.ts) - bu dört değişken BİLEREK
// wrangler.jsonc'nin "secrets.required" listesine EKLENMEDİ. O liste deploy'u tamamen ENGELLEYEN
// sert bir kapı; gerçek WhatsApp Business hesabı/şablon onayı işletme sahibinin dışarıda
// tamamlaması gereken bir adım olduğundan, bu secret'lar olmadan da deploy edilebilir kalmalı -
// yalnız gönderim fail-closed olur (bkz. isWhatsappConfigured kullanan her çağıran).
export interface WhatsappCredentials {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  checkoutTemplateName: string;
}

export async function getWhatsappCredentials(): Promise<WhatsappCredentials | null> {
  const { env } = await getCloudflareContext({ async: true });
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId = env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const checkoutTemplateName = env.WHATSAPP_CHECKOUT_TEMPLATE_NAME;
  if (!accessToken || !phoneNumberId || !businessAccountId || !checkoutTemplateName) return null;
  return { accessToken, phoneNumberId, businessAccountId, checkoutTemplateName };
}

export async function isWhatsappConfigured(): Promise<boolean> {
  return (await getWhatsappCredentials()) !== null;
}

// Webhook doğrulaması için: X-Hub-Signature-256 imzasını hesaplarken META_APP_SECRET (Instagram/
// Facebook ile PAYLAŞILAN aynı Meta App secret'ı - WhatsApp Business Platform bu projede aynı Meta
// App altında yapılandırılacak, yeni bir secret icat edilmedi) kullanılır. WHATSAPP_WEBHOOK_VERIFY_TOKEN
// yalnız GET doğrulama handshake'i (hub.verify_token) içindir, imza doğrulamasından bağımsızdır.
export async function getWhatsappWebhookSecrets(): Promise<{ appSecret: string; verifyToken: string } | null> {
  const { env } = await getCloudflareContext({ async: true });
  const appSecret = env.META_APP_SECRET;
  const verifyToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!appSecret || !verifyToken) return null;
  return { appSecret, verifyToken };
}
