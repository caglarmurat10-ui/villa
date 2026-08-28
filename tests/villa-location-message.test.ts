import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, HEAD } from "@/app/api/villas/[villa]/image/route";
import {
  buildVillaLocationMessage,
  normalizeWhatsAppNumber,
  whatsappUrl,
} from "@/lib/villaLocationMessages";
import { shareVillaLocation } from "@/lib/villaLocationShare";
import { VILLA_PROFILES } from "@/lib/villaProfiles";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("villa konum mesajı", () => {
  it.each([
    ["Safira", "Villa Safira", "https://share.google/safira"],
    ["Destan", "Villa Destan", "https://share.google/destan"],
  ] as const)("%s için doğru villa adı, konum ve giriş bilgisini üretir", (villa, expectedName, locationUrl) => {
    const message = buildVillaLocationMessage(villa, locationUrl);
    expect(message).toContain(`📍 ${expectedName} konumu:\n${locationUrl}`);
    expect(message).toContain("🕓 Giriş saati 16:00’dan sonradır.");
    expect(message).toContain("konuma yaklaşık 15 dakika kala bize haber vermenizi rica ederiz");
    expect(message).not.toContain("Müşteri");
  });

  it("Safira ve Destan fotoğraflarını kesin olarak ayırır", () => {
    expect(VILLA_PROFILES.Safira.publicImageUrl).toBe("/api/villas/safira/image");
    expect(VILLA_PROFILES.Destan.publicImageUrl).toBe("/api/villas/destan/image");
    expect(VILLA_PROFILES.Safira.sourceImageUrl).not.toBe(VILLA_PROFILES.Destan.sourceImageUrl);
  });

  it("WhatsApp telefonunu ve mesaj satırlarını doğru encode eder", () => {
    const text = buildVillaLocationMessage("Safira", "https://maps.example/safira?a=1&b=2");
    const url = new URL(whatsappUrl("0532 111 22 33", text));
    expect(normalizeWhatsAppNumber("0532 111 22 33")).toBe("905321112233");
    expect(url.pathname).toBe("/905321112233");
    expect(url.searchParams.get("text")).toBe(text);
  });
});

describe("villa fotoğrafı paylaşımı", () => {
  it("dosya paylaşımı destekleniyorsa fotoğraf ve metni birlikte paylaşır", async () => {
    const file = new File(["photo"], "villa-safira.jpg", { type: "image/jpeg" });
    const share = vi.fn().mockResolvedValue(undefined);
    const downloadImage = vi.fn();
    const openWhatsApp = vi.fn();
    const result = await shareVillaLocation({
      file,
      text: "konum",
      title: "Villa Safira",
      whatsappUrl: "https://wa.me/90?text=konum",
      publicImageUrl: "/api/villas/safira/image",
      imageFileBase: "villa-safira",
    }, {
      navigator: { canShare: () => true, share },
      downloadImage,
      openWhatsApp,
    });
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file], text: "konum", title: "Villa Safira" });
    expect(downloadImage).not.toHaveBeenCalled();
    expect(openWhatsApp).not.toHaveBeenCalled();
  });

  it("desteklenmeyen tarayıcıda fotoğraf indirme ve wa.me fallback'ini çalıştırır", async () => {
    const downloadImage = vi.fn();
    const openWhatsApp = vi.fn();
    const result = await shareVillaLocation({
      text: "konum",
      title: "Villa Destan",
      whatsappUrl: "https://wa.me/90?text=konum",
      publicImageUrl: "/api/villas/destan/image",
      imageFileBase: "villa-destan",
    }, {
      navigator: {},
      downloadImage,
      openWhatsApp,
    });
    expect(result).toBe("fallback");
    expect(downloadImage).toHaveBeenCalledWith("/api/villas/destan/image", "villa-destan");
    expect(openWhatsApp).toHaveBeenCalledWith("https://wa.me/90?text=konum");
  });
});

describe("public villa fotoğraf endpointi", () => {
  it.each(["safira", "destan"])("%s görselini public ve doğru Content-Type ile stream eder", async (villa) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/jpeg", "content-length": "3" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new Request(`https://example.com/api/villas/${villa}/image`), { params: Promise.resolve({ villa }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("public");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await response.arrayBuffer()).byteLength).toBe(3);
  });

  it("HEAD isteğini gövdesiz yanıtlar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, {
      status: 200,
      headers: { "content-type": "image/webp", "content-length": "42" },
    })));
    const response = await HEAD(new Request("https://example.com/api/villas/safira/image", { method: "HEAD" }), { params: Promise.resolve({ villa: "safira" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.body).toBeNull();
  });

  it("izin verilmeyen villa anahtarını ve upstream HTML yanıtını servis etmez", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const missing = await GET(new Request("https://example.com/api/villas/unknown/image"), { params: Promise.resolve({ villa: "unknown" }) });
    expect(missing.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(new Response("<html>not image</html>", { status: 200, headers: { "content-type": "text/html" } }));
    const invalid = await GET(new Request("https://example.com/api/villas/safira/image"), { params: Promise.resolve({ villa: "safira" }) });
    expect(invalid.status).toBe(502);
  });
});
