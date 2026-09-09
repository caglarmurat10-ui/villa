import { afterEach, describe, expect, it, vi } from "vitest";
import { sendWhatsappCheckoutReminder } from "./client";
import type { WhatsappCredentials } from "./config";

const credentials: WhatsappCredentials = {
  accessToken: "test-access-token",
  phoneNumberId: "1234567890",
  businessAccountId: "9999999999",
  checkoutTemplateName: "checkout_reminder_tr",
};

describe("sendWhatsappCheckoutReminder", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("başarılı Meta API yanıtından provider_message_id çıkarır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        messaging_product: "whatsapp",
        contacts: [{ input: "905412424455", wa_id: "905412424455" }],
        messages: [{ id: "wamid.HBgLOTA1NDEyNDI0NDU1FQIAERgS" }],
      }), { status: 200 }),
    ));

    const result = await sendWhatsappCheckoutReminder(credentials, "905412424455");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.providerMessageId).toBe("wamid.HBgLOTA1NDEyNDI0NDU1FQIAERgS");
  });

  it("doğru URL/headers/gövde ile Cloud API'ye istek atar (yalnız resmi Graph API endpoint'i)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: "wamid.ABC" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendWhatsappCheckoutReminder(credentials, "905412424455");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`);
    expect(init.headers.Authorization).toBe(`Bearer ${credentials.accessToken}`);
    const body = JSON.parse(init.body);
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.to).toBe("905412424455");
    expect(body.type).toBe("template");
    expect(body.template.name).toBe(credentials.checkoutTemplateName);
  });

  it("Meta API hata döndürürse ok:false ve hata mesajını sanitize edilmiş şekilde döner - başarılı sayılmaz", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Invalid parameter", type: "OAuthException", code: 100 } }), { status: 400 }),
    ));

    const result = await sendWhatsappCheckoutReminder(credentials, "905412424455");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Invalid parameter");
  });

  it("ağ hatası (fetch reddi) durumunda ok:false döner, throw ETMEZ", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await sendWhatsappCheckoutReminder(credentials, "905412424455");
    expect(result.ok).toBe(false);
  });

  it("başarılı HTTP ama messages alanı eksik/boş yanıt için de ok:false döner (sahte başarı yok)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    const result = await sendWhatsappCheckoutReminder(credentials, "905412424455");
    expect(result.ok).toBe(false);
  });

  it("uzun opak dizeleri (olası token benzeri) hata mesajından REDACTED yapar", async () => {
    const longOpaqueToken = "a".repeat(60);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: `Auth failed for token ${longOpaqueToken}` } }), { status: 401 }),
    ));

    const result = await sendWhatsappCheckoutReminder(credentials, "905412424455");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("[REDACTED]");
      expect(result.reason).not.toContain(longOpaqueToken);
    }
  });
});
