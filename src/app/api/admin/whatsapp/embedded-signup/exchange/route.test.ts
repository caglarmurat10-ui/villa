import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let envOverride: Record<string, string | undefined> = { FACEBOOK_APP_ID: "app-id", FACEBOOK_APP_SECRET: "app-secret" };
let exchangeResult: { ok: true; accessToken: string; expiresInSeconds: number | null } | { ok: false; reason: string } = { ok: true, accessToken: "EAAtest", expiresInSeconds: 123 };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: envOverride }),
}));

vi.mock("@/lib/whatsapp/embedded-signup-client", () => ({
  exchangeEmbeddedSignupCode: async () => exchangeResult,
}));

function postRequest(body: unknown) {
  return new NextRequest("https://admin.safiradestan.com/api/admin/whatsapp/embedded-signup/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/whatsapp/embedded-signup/exchange", () => {
  afterEach(() => {
    envOverride = { FACEBOOK_APP_ID: "app-id", FACEBOOK_APP_SECRET: "app-secret" };
    exchangeResult = { ok: true, accessToken: "EAAtest", expiresInSeconds: 123 };
    vi.resetModules();
  });

  it("code eksikse 400 döner", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({}));
    expect(response.status).toBe(400);
  });

  it("FACEBOOK_APP_ID/SECRET yapılandırılmamışsa 503 döner (fail-closed)", async () => {
    envOverride = {};
    const { POST } = await import("./route");
    const response = await POST(postRequest({ code: "abc" }));
    expect(response.status).toBe(503);
  });

  it("başarılı değişim access_token'ı yanıtta döner", async () => {
    exchangeResult = { ok: true, accessToken: "EAAsecrettoken", expiresInSeconds: 999 };
    const { POST } = await import("./route");
    const response = await POST(postRequest({ code: "valid-code" }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.accessToken).toBe("EAAsecrettoken");
    expect(data.expiresInSeconds).toBe(999);
  });

  it("Meta değişimi başarısız olursa 502 ve hata mesajını döner - sahte token üretmez", async () => {
    exchangeResult = { ok: false, reason: "Invalid verification code format." };
    const { POST } = await import("./route");
    const response = await POST(postRequest({ code: "bad-code" }));
    expect(response.status).toBe(502);
    const data = await response.json();
    expect(data.error).toContain("Invalid verification code format");
    expect(data.accessToken).toBeUndefined();
  });
});
