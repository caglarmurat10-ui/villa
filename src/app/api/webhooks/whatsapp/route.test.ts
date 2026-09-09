import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let webhookSecrets: { appSecret: string; verifyToken: string } | null = { appSecret: "app-secret", verifyToken: "verify-token" };
let signatureValid = true;

const delivered: string[] = [];
const read: string[] = [];
const failed: string[] = [];

vi.mock("@/lib/whatsapp/config", () => ({
  getWhatsappWebhookSecrets: async () => webhookSecrets,
}));

vi.mock("@/lib/whatsapp/webhook-signature", () => ({
  verifyWhatsappWebhookSignature: async () => signatureValid,
}));

vi.mock("@/lib/whatsapp/store", () => ({
  markCheckoutReminderDeliveredByProviderMessageId: async (id: string) => { delivered.push(id); },
  markCheckoutReminderReadByProviderMessageId: async (id: string) => { read.push(id); },
  markCheckoutReminderFailedByProviderMessageId: async (id: string) => { failed.push(id); },
}));

function statusPayload(status: string, id = "wamid.TEST") {
  return JSON.stringify({
    entry: [{ changes: [{ value: { statuses: [{ id, status, timestamp: "1700000000" }] } }] }],
  });
}

function webhookRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://admin.safiradestan.com/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("GET /api/webhooks/whatsapp (Meta doğrulama handshake)", () => {
  afterEach(() => {
    webhookSecrets = { appSecret: "app-secret", verifyToken: "verify-token" };
    vi.resetModules();
  });

  it("yapılandırma yoksa 503 WHATSAPP_NOT_CONFIGURED döner", async () => {
    webhookSecrets = null;
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("https://admin.safiradestan.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=x&hub.challenge=123"));
    expect(response.status).toBe(503);
  });

  it("doğru verify_token ile challenge'ı aynen döner", async () => {
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("https://admin.safiradestan.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=123456"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("123456");
  });

  it("yanlış verify_token için 403 döner", async () => {
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("https://admin.safiradestan.com/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456"));
    expect(response.status).toBe(403);
  });
});

describe("POST /api/webhooks/whatsapp (durum bildirimleri)", () => {
  afterEach(() => {
    webhookSecrets = { appSecret: "app-secret", verifyToken: "verify-token" };
    signatureValid = true;
    delivered.length = 0;
    read.length = 0;
    failed.length = 0;
    vi.resetModules();
  });

  it("yapılandırma yoksa 503 döner, hiçbir satır güncellenmez", async () => {
    webhookSecrets = null;
    const { POST } = await import("./route");
    const response = await POST(webhookRequest(statusPayload("delivered")));
    expect(response.status).toBe(503);
    expect(delivered).toHaveLength(0);
  });

  it("geçersiz imza için 401 döner, hiçbir satır güncellenmez", async () => {
    signatureValid = false;
    const { POST } = await import("./route");
    const response = await POST(webhookRequest(statusPayload("delivered"), { "x-hub-signature-256": "sha256=deadbeef" }));
    expect(response.status).toBe(401);
    expect(delivered).toHaveLength(0);
  });

  it("geçerli imza + delivered durumu markCheckoutReminderDeliveredByProviderMessageId çağırır", async () => {
    const { POST } = await import("./route");
    const response = await POST(webhookRequest(statusPayload("delivered", "wamid.D1"), { "x-hub-signature-256": "sha256=validsig" }));
    expect(response.status).toBe(200);
    expect(delivered).toEqual(["wamid.D1"]);
  });

  it("read durumu markCheckoutReminderReadByProviderMessageId çağırır", async () => {
    const { POST } = await import("./route");
    await POST(webhookRequest(statusPayload("read", "wamid.R1"), { "x-hub-signature-256": "sha256=validsig" }));
    expect(read).toEqual(["wamid.R1"]);
  });

  it("failed durumu markCheckoutReminderFailedByProviderMessageId çağırır", async () => {
    const { POST } = await import("./route");
    await POST(webhookRequest(statusPayload("failed", "wamid.F1"), { "x-hub-signature-256": "sha256=validsig" }));
    expect(failed).toEqual(["wamid.F1"]);
  });

  it("boş/ilgisiz payload için 200 döner ama hiçbir mark fonksiyonu çağrılmaz", async () => {
    const { POST } = await import("./route");
    const response = await POST(webhookRequest(JSON.stringify({ entry: [] }), { "x-hub-signature-256": "sha256=validsig" }));
    expect(response.status).toBe(200);
    expect(delivered).toHaveLength(0);
    expect(read).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });
});
