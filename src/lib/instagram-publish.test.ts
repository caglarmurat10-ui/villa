import { afterEach, describe, expect, it, vi } from "vitest";
import { publicGraphError, publishInstagramStory } from "./instagram-publish";

function fakeResponse(status: number): Response {
  return new Response(null, { status });
}

describe("publicGraphError", () => {
  it("bilinen hata kodu (9007) icin okunabilir ipucu ekler", () => {
    const message = publicGraphError("Instagram yayını başarısız", fakeResponse(400), { error: { code: 9007 } });
    expect(message).toBe("Instagram yayını başarısız (HTTP 400 / 9007) — medya işleme tamamlanmamış olabilir (video/reels için yayından önce daha uzun bekleme gerekebilir)");
  });

  it("bilinmeyen hata kodu icin ipucu eklemez, temel formati korur", () => {
    const message = publicGraphError("Instagram yayını başarısız", fakeResponse(400), { error: { code: 999999 } });
    expect(message).toBe("Instagram yayını başarısız (HTTP 400 / 999999)");
  });

  it("hata kodu yoksa yalniz HTTP durumunu gosterir", () => {
    const message = publicGraphError("Instagram yayını başarısız", fakeResponse(500), {});
    expect(message).toBe("Instagram yayını başarısız (HTTP 500)");
  });

  it("gercek Safira story hatasindaki (HTTP 400/9007) ile aynen eslesir", () => {
    // Production'da gorulen kayit: 1b2df50a-...  last_publish_error = "Instagram yayını başarısız (HTTP 400 / 9007)"
    // - onceki kod bu formati uretiyordu, degisiklik yalniz sona ipucu EKLER, mevcut prefix'i bozmaz.
    const message = publicGraphError("Instagram yayını başarısız", fakeResponse(400), { error: { code: 9007 } });
    expect(message.startsWith("Instagram yayını başarısız (HTTP 400 / 9007)")).toBe(true);
  });
});

describe("publishInstagramStory (2026-09-02 HTTP 400/9007 regresyon fix testi)", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockGraphSequence(statusSequence: string[]) {
    let statusCallIndex = 0;
    const calls: Array<{ url: string; method: string }> = [];
    global.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = url.toString();
      const method = init?.method ?? "GET";
      calls.push({ url: href, method });
      if (method === "POST" && href.endsWith("/media")) {
        return new Response(JSON.stringify({ id: "container-1" }), { status: 200 });
      }
      if (method === "GET" && href.includes("/container-1")) {
        const status = statusSequence[Math.min(statusCallIndex, statusSequence.length - 1)];
        statusCallIndex += 1;
        return new Response(JSON.stringify({ status_code: status }), { status: 200 });
      }
      if (method === "POST" && href.endsWith("/media_publish")) {
        return new Response(JSON.stringify({ id: "post-1" }), { status: 200 });
      }
      throw new Error(`beklenmeyen istek: ${method} ${href}`);
    }) as unknown as typeof fetch;
    return calls;
  }

  it("resim (image) Story'de bile media_publish'ten once container durumunu kontrol eder", async () => {
    const calls = mockGraphSequence(["FINISHED"]);
    await publishInstagramStory("acc-1", "token-1", { position: 0, kind: "image", mediaUrl: "https://example.com/a.jpg" });
    const statusCallIdx = calls.findIndex((c) => c.url.includes("/container-1"));
    const publishCallIdx = calls.findIndex((c) => c.url.endsWith("/media_publish"));
    expect(statusCallIdx).toBeGreaterThan(-1); // resim icin de durum kontrolu YAPILDI (eski davranista atlanirdi)
    expect(statusCallIdx).toBeLessThan(publishCallIdx); // ve publish'ten ONCE calisti
  });

  it("video Story'de de ayni sekilde bekler (mevcut davranis korunuyor)", async () => {
    const calls = mockGraphSequence(["IN_PROGRESS", "FINISHED"]);
    await publishInstagramStory("acc-1", "token-1", { position: 0, kind: "video", mediaUrl: "https://example.com/a.mp4" });
    const statusCalls = calls.filter((c) => c.url.includes("/container-1"));
    expect(statusCalls.length).toBeGreaterThanOrEqual(2); // IN_PROGRESS sonra FINISHED gorulene kadar tekrar dener
  });

  it("container ERROR donerse yayin denemesi (media_publish) hic yapilmaz", async () => {
    const calls = mockGraphSequence(["ERROR"]);
    await expect(publishInstagramStory("acc-1", "token-1", { position: 0, kind: "image", mediaUrl: "https://example.com/a.jpg" })).rejects.toThrow();
    expect(calls.some((c) => c.url.endsWith("/media_publish"))).toBe(false);
  });
});
