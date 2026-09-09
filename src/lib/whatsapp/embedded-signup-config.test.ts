import { afterEach, describe, expect, it, vi } from "vitest";

let envOverride: Record<string, string | undefined> = {};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: envOverride }),
}));

describe("getWhatsappEmbeddedSignupConfig (fail-closed)", () => {
  afterEach(() => {
    envOverride = {};
    vi.resetModules();
  });

  it("FACEBOOK_APP_ID + WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID ikisi de varsa döner", async () => {
    envOverride = { FACEBOOK_APP_ID: "2333943650679330", WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: "cfg123" };
    const { getWhatsappEmbeddedSignupConfig } = await import("./embedded-signup-config");
    expect(await getWhatsappEmbeddedSignupConfig()).toEqual({ appId: "2333943650679330", configId: "cfg123" });
  });

  it("config_id henüz Meta panelinde oluşturulmadığında (yok) null döner - buton kapalı kalır", async () => {
    envOverride = { FACEBOOK_APP_ID: "2333943650679330" };
    const { getWhatsappEmbeddedSignupConfig } = await import("./embedded-signup-config");
    expect(await getWhatsappEmbeddedSignupConfig()).toBeNull();
  });

  it("hiçbiri tanımlı değilse null döner", async () => {
    envOverride = {};
    const { getWhatsappEmbeddedSignupConfig } = await import("./embedded-signup-config");
    expect(await getWhatsappEmbeddedSignupConfig()).toBeNull();
  });
});
