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
    entry: [{ changes: [{ field: "messages", value: { statuses: [{ id, status, timestamp: "1700000000" }] } }] }],
  });
}

function webhookRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://admin.safiradestan.com/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

const SIGNED = { "x-hub-signature-256": "sha256=validsig" };

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

describe("POST /api/webhooks/whatsapp (durum bildirimleri + Coexistence olayları)", () => {
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
    const response = await POST(webhookRequest(statusPayload("delivered", "wamid.D1"), SIGNED));
    expect(response.status).toBe(200);
    expect(delivered).toEqual(["wamid.D1"]);
  });

  it("read durumu markCheckoutReminderReadByProviderMessageId çağırır", async () => {
    const { POST } = await import("./route");
    await POST(webhookRequest(statusPayload("read", "wamid.R1"), SIGNED));
    expect(read).toEqual(["wamid.R1"]);
  });

  it("failed durumu markCheckoutReminderFailedByProviderMessageId çağırır", async () => {
    const { POST } = await import("./route");
    await POST(webhookRequest(statusPayload("failed", "wamid.F1"), SIGNED));
    expect(failed).toEqual(["wamid.F1"]);
  });

  it("aynı delivered webhook'u İKİ KEZ gönderilse (Meta'nın kendi retry'ı) idempotenttir - ikinci çağrı da güvenle işlenir, hata vermez", async () => {
    const { POST } = await import("./route");
    const payload = statusPayload("delivered", "wamid.DUP1");
    const first = await POST(webhookRequest(payload, SIGNED));
    const second = await POST(webhookRequest(payload, SIGNED));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // store.ts'teki markCheckoutReminderDeliveredByProviderMessageId zaten WHERE status='SENT' korumalı
    // (bkz. store.test.ts) - burada webhook route'unun aynı payload'ı güvenle iki kez işleyebildiğini,
    // hata fırlatmadığını doğruluyoruz.
    expect(delivered).toEqual(["wamid.DUP1", "wamid.DUP1"]);
  });

  it("boş/ilgisiz payload için 200 döner ama hiçbir mark fonksiyonu çağrılmaz", async () => {
    const { POST } = await import("./route");
    const response = await POST(webhookRequest(JSON.stringify({ entry: [] }), SIGNED));
    expect(response.status).toBe(200);
    expect(delivered).toHaveLength(0);
    expect(read).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });

  it("'messages' field'ındaki gelen müşteri mesajları (value.messages) SAYILIR ama İÇERİĞİ hiçbir yere yazılmaz", async () => {
    const { POST } = await import("./route");
    const payload = JSON.stringify({
      entry: [{ changes: [{ field: "messages", value: { messages: [
        { from: "905551112233", id: "wamid.IN1", timestamp: "1700000000", type: "text", text: { body: "Merhaba, sorum var" } },
      ] } }] }],
    });
    const response = await POST(webhookRequest(payload, SIGNED));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.inboundMessagesIgnored).toBe(1);
    // Bu test dosyasındaki mock store'da mesaj içeriğini kaydeden HİÇBİR fonksiyon yok - route'un
    // yalnız store.ts'te export edilen mark* fonksiyonlarını çağırdığı (ve onların da yalnız
    // id/timestamp/reason parametreleri aldığı, tam mesaj metnini asla almadığı) kod incelemesiyle
    // doğrulanır.
    expect(delivered).toHaveLength(0);
  });

  it("Coexistence 'history' olayı 200 ile ACK edilir, hiçbir mark fonksiyonu çağrılmaz, çökme olmaz", async () => {
    const { POST } = await import("./route");
    const payload = JSON.stringify({
      entry: [{ changes: [{ field: "history", value: {
        phases: [{ phase: 0, chunk_order: 1, progress: 100 }],
        threads: [{ id: "905551112233", messages: [{ id: "wamid.HIST1", text: { body: "geçmiş mesaj" } }] }],
      } }] }],
    });
    const response = await POST(webhookRequest(payload, SIGNED));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.historyEventsIgnored).toBe(1);
    expect(delivered).toHaveLength(0);
    expect(read).toHaveLength(0);
    expect(failed).toHaveLength(0);
  });

  it("Coexistence 'smb_app_state_sync' olayı 200 ile ACK edilir, kişi bilgisi hiçbir yere yazılmaz", async () => {
    const { POST } = await import("./route");
    const payload = JSON.stringify({
      entry: [{ changes: [{ field: "smb_app_state_sync", value: {
        state_sync: [{ type: "contact", contact: { full_name: "Test Misafir", phone_number: "905551112233" }, action: "add" }],
      } }] }],
    });
    const response = await POST(webhookRequest(payload, SIGNED));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.contactSyncEventsIgnored).toBe(1);
  });

  it("Coexistence 'smb_message_echoes' olayı 200 ile ACK edilir, yansıyan mesaj içeriği hiçbir yere yazılmaz", async () => {
    const { POST } = await import("./route");
    const payload = JSON.stringify({
      entry: [{ changes: [{ field: "smb_message_echoes", value: {
        message_echoes: [{ from: "905412424455", to: "905551112233", id: "wamid.ECHO1", text: { body: "WhatsApp uygulamasından yanıt" } }],
      } }] }],
    });
    const response = await POST(webhookRequest(payload, SIGNED));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.messageEchoesIgnored).toBe(1);
  });

  it("bilinmeyen/gelecekteki bir field ADI için ÇÖKMEZ, 200 ile ACK eder", async () => {
    const { POST } = await import("./route");
    const payload = JSON.stringify({
      entry: [{ changes: [{ field: "future_unknown_field_xyz", value: { anything: "goes here" } }] }],
    });
    const response = await POST(webhookRequest(payload, SIGNED));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.unknownFieldsIgnored).toBe(1);
  });

  it("aynı payload'da hem 'messages' (durum) hem 'history' hem bilinmeyen bir field birlikte gelirse hepsi ayrı ayrı doğru sayılır", async () => {
    const { POST } = await import("./route");
    const payload = JSON.stringify({
      entry: [{ changes: [
        { field: "messages", value: { statuses: [{ id: "wamid.MIX1", status: "delivered", timestamp: "1700000000" }] } },
        { field: "history", value: { threads: [] } },
        { field: "smb_weird_future_field", value: {} },
      ] }],
    });
    const response = await POST(webhookRequest(payload, SIGNED));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(delivered).toEqual(["wamid.MIX1"]);
    expect(data.historyEventsIgnored).toBe(1);
    expect(data.unknownFieldsIgnored).toBe(1);
  });
});
