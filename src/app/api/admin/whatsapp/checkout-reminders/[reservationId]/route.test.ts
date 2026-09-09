import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let setAutoEnabledResult: unknown = { id: "msg1", autoEnabled: false };
let retryResult: unknown = null;

vi.mock("@/lib/whatsapp/store", () => ({
  setCheckoutReminderAutoEnabled: async () => setAutoEnabledResult,
  retryFailedCheckoutReminder: async () => retryResult,
}));

function patchRequest(action: string) {
  return new NextRequest("https://admin.safiradestan.com/api/admin/whatsapp/checkout-reminders/res1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

function ctx() {
  return { params: Promise.resolve({ reservationId: "res1" }) };
}

describe("PATCH /api/admin/whatsapp/checkout-reminders/[reservationId]", () => {
  afterEach(() => {
    setAutoEnabledResult = { id: "msg1", autoEnabled: false };
    retryResult = null;
    vi.resetModules();
  });

  it("geçersiz action değeri için 400 döner", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest("delete-everything"), ctx());
    expect(response.status).toBe(400);
  });

  it("enable/disable: SCHEDULED bir kayıt yoksa 404 döner", async () => {
    setAutoEnabledResult = null;
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest("disable"), ctx());
    expect(response.status).toBe(404);
  });

  it("enable/disable: başarılı olduğunda güncellenmiş kaydı döner", async () => {
    setAutoEnabledResult = { id: "msg1", autoEnabled: false };
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest("disable"), ctx());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message.autoEnabled).toBe(false);
  });

  it("retry: gerçekten FAILED bir kayıt yoksa 409 döner (rastgele retry'a izin verilmez)", async () => {
    retryResult = null;
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest("retry"), ctx());
    expect(response.status).toBe(409);
  });

  it("retry: gerçek bir FAILED kayıt varsa SCHEDULED'a döndürüp 200 ile sonucu döner", async () => {
    retryResult = { id: "msg1", status: "SCHEDULED" };
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest("retry"), ctx());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message.status).toBe("SCHEDULED");
  });
});
