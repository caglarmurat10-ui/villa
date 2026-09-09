import { getCloudflareContext } from "@opennextjs/cloudflare";

// WhatsApp Embedded Signup (Coexistence) için Meta panelinde AYRICA oluşturulması gereken bir
// "Facebook Login for Business" config'i - mevcut FACEBOOK_CONFIG_ID (Facebook Sayfa bağlantısı
// için kullanılan) ile KARIŞTIRILMAMALI, WhatsApp business_management/business_messaging izinleriyle
// AYRI bir config. Bu değer secret DEĞİLDİR (Meta'nın kendi örnekleri client-side JS içine gömer),
// ama gerçek bir config Meta panelinde oluşturulana kadar tanımlı olmayacağı için PayTR/WhatsApp
// credentials ile AYNI fail-closed desende: yoksa bağlantı paneli kapalı kalır, hiçbir sahte/varsayılan
// ID kullanılmaz.
export interface WhatsappEmbeddedSignupConfig {
  appId: string;
  configId: string;
}

export async function getWhatsappEmbeddedSignupConfig(): Promise<WhatsappEmbeddedSignupConfig | null> {
  const { env } = await getCloudflareContext({ async: true });
  const appId = env.FACEBOOK_APP_ID;
  const configId = env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID;
  if (!appId || !configId) return null;
  return { appId, configId };
}
