import { afterEach, describe, expect, it, vi } from "vitest";

type Due = { id: string; recipientPhone: string };

let dueMessages: Due[] = [];
let credentials: { accessToken: string; phoneNumberId: string; businessAccountId: string; checkoutTemplateName: string } | null = null;
let claimResult = true;
let sendResult: { ok: true; providerMessageId: string } | { ok: false; reason: string } = { ok: true, providerMessageId: "wamid.TEST" };

const markedSent: string[] = [];
const markedFailed: string[] = [];
const markedSkipped: string[] = [];
let requeueCallCount = 0;
let requeueResult = 0;

vi.mock("@/lib/whatsapp/store", () => ({
  listDueCheckoutReminders: async () => dueMessages,
  claimCheckoutReminderForSending: async (id: string) => { void id; return claimResult; },
  markCheckoutReminderSent: async (id: string) => { markedSent.push(id); },
  markCheckoutReminderFailed: async (id: string) => { markedFailed.push(id); },
  markCheckoutReminderSkippedNotConfigured: async (id: string) => { markedSkipped.push(id); },
  requeueSkippedNotConfiguredRemindersWhenReady: async () => { requeueCallCount += 1; return requeueResult; },
}));

vi.mock("@/lib/whatsapp/config", () => ({
  getWhatsappCredentials: async () => credentials,
}));

vi.mock("@/lib/whatsapp/client", () => ({
  sendWhatsappCheckoutReminder: async () => sendResult,
}));

describe("POST /api/admin/whatsapp/dispatch-due", () => {
  afterEach(() => {
    dueMessages = [];
    credentials = null;
    claimResult = true;
    sendResult = { ok: true, providerMessageId: "wamid.TEST" };
    markedSent.length = 0;
    markedFailed.length = 0;
    markedSkipped.length = 0;
    requeueCallCount = 0;
    requeueResult = 0;
    vi.resetModules();
  });

  it("bekleyen mesaj yoksa candidateCount:0 döner, hiçbir şey işlemez", async () => {
    const { POST } = await import("./route");
    const response = await POST();
    const data = await response.json();
    expect(data.candidateCount).toBe(0);
    expect(data.sent).toBe(0);
  });

  it("WhatsApp yapılandırılmamışsa (credentials null) SKIPPED_NOT_CONFIGURED işaretler, ASLA sahte SENT üretmez", async () => {
    dueMessages = [{ id: "m1", recipientPhone: "905412424455" }];
    credentials = null;
    const { POST } = await import("./route");
    const response = await POST();
    const data = await response.json();
    expect(data.skippedNotConfigured).toBe(1);
    expect(data.sent).toBe(0);
    expect(markedSkipped).toEqual(["m1"]);
    expect(markedSent).toHaveLength(0);
  });

  it("başarılı Meta API çağrısı sonrası markCheckoutReminderSent çağrılır (yalnız gerçek başarıda)", async () => {
    dueMessages = [{ id: "m2", recipientPhone: "905412424455" }];
    credentials = { accessToken: "t", phoneNumberId: "p", businessAccountId: "b", checkoutTemplateName: "checkout_reminder_tr" };
    sendResult = { ok: true, providerMessageId: "wamid.OK" };
    const { POST } = await import("./route");
    const response = await POST();
    const data = await response.json();
    expect(data.sent).toBe(1);
    expect(markedSent).toEqual(["m2"]);
  });

  it("başarısız Meta API çağrısı markCheckoutReminderFailed çağırır, markCheckoutReminderSent ÇAĞIRMAZ", async () => {
    dueMessages = [{ id: "m3", recipientPhone: "905412424455" }];
    credentials = { accessToken: "t", phoneNumberId: "p", businessAccountId: "b", checkoutTemplateName: "checkout_reminder_tr" };
    sendResult = { ok: false, reason: "Meta API HTTP 400" };
    const { POST } = await import("./route");
    const response = await POST();
    const data = await response.json();
    expect(data.failed).toBe(1);
    expect(markedFailed).toEqual(["m3"]);
    expect(markedSent).toHaveLength(0);
  });

  it("claim başarısız olursa (başka bir tetikleme zaten aldı) hiçbir gönderim/işaretleme yapılmaz - eşzamanlı tetikleme güvenliği", async () => {
    dueMessages = [{ id: "m4", recipientPhone: "905412424455" }];
    credentials = { accessToken: "t", phoneNumberId: "p", businessAccountId: "b", checkoutTemplateName: "checkout_reminder_tr" };
    claimResult = false;
    const { POST } = await import("./route");
    const response = await POST();
    const data = await response.json();
    expect(data.alreadyClaimed).toBe(1);
    expect(markedSent).toHaveLength(0);
    expect(markedFailed).toHaveLength(0);
    expect(markedSkipped).toHaveLength(0);
  });

  it("yapılandırma yokken requeueSkippedNotConfiguredRemindersWhenReady HİÇ çağrılmaz", async () => {
    credentials = null;
    const { POST } = await import("./route");
    await POST();
    expect(requeueCallCount).toBe(0);
  });

  it("yapılandırma HAZIR olduğunda her turda requeueSkippedNotConfiguredRemindersWhenReady çağrılır ve sonucu yanıtta 'requeued' olarak döner", async () => {
    credentials = { accessToken: "t", phoneNumberId: "p", businessAccountId: "b", checkoutTemplateName: "checkout_reminder_tr" };
    requeueResult = 3;
    const { POST } = await import("./route");
    const response = await POST();
    const data = await response.json();
    expect(requeueCallCount).toBe(1);
    expect(data.requeued).toBe(3);
  });
});
