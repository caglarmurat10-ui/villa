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

// DÜZELTME (2026-09-09 audit): Bu fonksiyon ÖNCEDEN META_APP_SECRET okuyordu - bu YANLIŞTI. Bu
// projede META_APP_ID/META_APP_SECRET yalnız AYRI bir "Instagram" uygulamasına ait (bkz. src/lib/meta.ts
// - instagram.com/oauth/authorize, api.instagram.com, graph.instagram.com; facebook.ts'teki
// "Instagram App ID Facebook Login için kullanılamaz" hata mesajı bu ayrımı doğrular). WhatsApp
// Business Platform kullanım senaryosu ise Meta Geliştirici panelinde "Villa Yönetimi" adlı, App ID
// 2333943650679330 olan AYRI bir uygulama altında - ve bu ID, wrangler.jsonc'de zaten
// FACEBOOK_APP_ID olarak kayıtlı (Facebook Login/Page bağlantısı için kullanılan aynı uygulama).
// Meta, bir webhook'u imzalarken HER ZAMAN o webhook aboneliğini barındıran uygulamanın App Secret'ını
// kullanır - bu yüzden doğru secret FACEBOOK_APP_SECRET'tır, META_APP_SECRET DEĞİL.
// WHATSAPP_WEBHOOK_VERIFY_TOKEN yalnız GET doğrulama handshake'i (hub.verify_token) içindir, imza
// doğrulamasından bağımsızdır.
export async function getWhatsappWebhookSecrets(): Promise<{ appSecret: string; verifyToken: string } | null> {
  const { env } = await getCloudflareContext({ async: true });
  const appSecret = env.FACEBOOK_APP_SECRET;
  const verifyToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!appSecret || !verifyToken) return null;
  return { appSecret, verifyToken };
}
