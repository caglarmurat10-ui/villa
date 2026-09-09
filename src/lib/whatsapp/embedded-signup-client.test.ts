import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeEmbeddedSignupCode } from "./embedded-signup-client";

describe("exchangeEmbeddedSignupCode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("başarılı Meta yanıtından access_token ve expires_in çıkarır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "EAAtest123", token_type: "bearer", expires_in: 5183944 }), { status: 200 }),
    ));
    const result = await exchangeEmbeddedSignupCode("app-id", "app-secret", "auth-code");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.accessToken).toBe("EAAtest123");
      expect(result.expiresInSeconds).toBe(5183944);
    }
  });

  it("doğru endpoint'e ve query parametrelerine (redirect_uri OLMADAN) istek atar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "x" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await exchangeEmbeddedSignupCode("app-id-1", "app-secret-1", "code-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [urlArg] = fetchMock.mock.calls[0];
    const url = new URL(String(urlArg));
    expect(url.origin + url.pathname).toBe("https://graph.facebook.com/v21.0/oauth/access_token");
    expect(url.searchParams.get("client_id")).toBe("app-id-1");
    expect(url.searchParams.get("client_secret")).toBe("app-secret-1");
    expect(url.searchParams.get("code")).toBe("code-1");
    expect(url.searchParams.has("redirect_uri")).toBe(false);
  });

  it("Meta hata döndürürse ok:false ve mesajı döner - sahte başarı üretmez", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Invalid verification code format.", code: 100 } }), { status: 400 }),
    ));
    const result = await exchangeEmbeddedSignupCode("app-id", "app-secret", "bad-code");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Invalid verification code format");
  });

  it("ağ hatasında throw ETMEZ, ok:false döner", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await exchangeEmbeddedSignupCode("app-id", "app-secret", "code");
    expect(result.ok).toBe(false);
  });

  it("access_token eksik başarılı HTTP yanıtı için de ok:false döner", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
    const result = await exchangeEmbeddedSignupCode("app-id", "app-secret", "code");
    expect(result.ok).toBe(false);
  });

  it("uzun opak dizeleri (app_secret/token benzeri) hata mesajından REDACTED yapar", async () => {
    const longOpaque = "b".repeat(60);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: `Bad secret ${longOpaque}` } }), { status: 401 }),
    ));
    const result = await exchangeEmbeddedSignupCode("app-id", "app-secret", "code");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("[REDACTED]");
      expect(result.reason).not.toContain(longOpaque);
    }
  });
});
