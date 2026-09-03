import { describe, expect, it } from "vitest";
import { publicGraphError } from "./instagram-publish";

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
