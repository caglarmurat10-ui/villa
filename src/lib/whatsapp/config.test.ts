import { afterEach, describe, expect, it, vi } from "vitest";

let envOverride: Record<string, string | undefined> = {};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: envOverride }),
}));

describe("getWhatsappCredentials (fail-closed - PayTR ile aynı desen)", () => {
  afterEach(() => {
    envOverride = {};
    vi.resetModules();
  });

  it("dört gerekli değişkenin tamamı tanımlıysa kimlik bilgilerini döner", async () => {
    envOverride = {
      WHATSAPP_ACCESS_TOKEN: "token",
      WHATSAPP_PHONE_NUMBER_ID: "123",
      WHATSAPP_BUSINESS_ACCOUNT_ID: "456",
      WHATSAPP_CHECKOUT_TEMPLATE_NAME: "checkout_reminder_tr",
    };
    const { getWhatsappCredentials, isWhatsappConfigured } = await import("./config");
    const credentials = await getWhatsappCredentials();
    expect(credentials).toEqual({
      accessToken: "token",
      phoneNumberId: "123",
      businessAccountId: "456",
      checkoutTemplateName: "checkout_reminder_tr",
    });
    expect(await isWhatsappConfigured()).toBe(true);
  });

  it("hiçbir secret yokken null döner (fail-closed) - deploy'u engellemez", async () => {
    envOverride = {};
    const { getWhatsappCredentials, isWhatsappConfigured } = await import("./config");
    expect(await getWhatsappCredentials()).toBeNull();
    expect(await isWhatsappConfigured()).toBe(false);
  });

  it("dört değişkenden yalnız biri eksikse yine null döner (kısmi yapılandırma kabul edilmez)", async () => {
    envOverride = {
      WHATSAPP_ACCESS_TOKEN: "token",
      WHATSAPP_PHONE_NUMBER_ID: "123",
      WHATSAPP_BUSINESS_ACCOUNT_ID: "456",
      // WHATSAPP_CHECKOUT_TEMPLATE_NAME eksik
    };
    const { getWhatsappCredentials } = await import("./config");
    expect(await getWhatsappCredentials()).toBeNull();
  });
});

describe("getWhatsappWebhookSecrets", () => {
  afterEach(() => {
    envOverride = {};
    vi.resetModules();
  });

  it("FACEBOOK_APP_SECRET + WHATSAPP_WEBHOOK_VERIFY_TOKEN ikisi de varsa döner (WhatsApp'ı barındıran gerçek uygulama - bkz. audit notu)", async () => {
    envOverride = { FACEBOOK_APP_SECRET: "app-secret", WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-token" };
    const { getWhatsappWebhookSecrets } = await import("./config");
    expect(await getWhatsappWebhookSecrets()).toEqual({ appSecret: "app-secret", verifyToken: "verify-token" });
  });

  it("yalnız biri tanımlıysa null döner", async () => {
    envOverride = { FACEBOOK_APP_SECRET: "app-secret" };
    const { getWhatsappWebhookSecrets } = await import("./config");
    expect(await getWhatsappWebhookSecrets()).toBeNull();
  });

  it("META_APP_SECRET (ayrı Instagram uygulamasının secret'ı) tek başına YETERLİ DEĞİLDİR - yanlış uygulamanın secret'ı WhatsApp imzasını doğrulayamaz", async () => {
    envOverride = { META_APP_SECRET: "wrong-app-secret", WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify-token" };
    const { getWhatsappWebhookSecrets } = await import("./config");
    expect(await getWhatsappWebhookSecrets()).toBeNull();
  });
});
