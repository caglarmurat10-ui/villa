import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../google-api", () => ({
  getGoogleAccessToken: async () => "fake-access-token",
}));

import { ensureGbpBookingLink, expectedGbpBookingLink, readGbpWebsiteUri } from "./profile";

describe("expectedGbpBookingLink - section 5 dogru villa + UTM", () => {
  it("Safira kendi first-party sayfasina, dogru UTM ile", () => {
    const url = new URL(expectedGbpBookingLink("Safira"));
    expect(url.pathname).toBe("/villa-safira");
    expect(url.searchParams.get("utm_source")).toBe("google");
    expect(url.searchParams.get("utm_medium")).toBe("organic_gbp");
    expect(url.searchParams.get("utm_campaign")).toBe("booking");
  });
  it("Destan kendi first-party sayfasina - cross-villa yok", () => {
    const url = new URL(expectedGbpBookingLink("Destan"));
    expect(url.pathname).toBe("/villa-destan");
  });
});

describe("ensureGbpBookingLink - yalniz farkliysa yazar, PATCH gorvdesi yalniz websiteUri icerir, read-back dogrulanir", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mevcut websiteUri zaten dogruysa HICBIR PATCH gondermez, action='unchanged' doner", async () => {
    const target = expectedGbpBookingLink("Safira");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ websiteUri: target }), { status: 200 }));
    const result = await ensureGbpBookingLink("Safira", "accounts/1/locations/1");
    expect(result.action).toBe("unchanged");
    expect(fetchMock).toHaveBeenCalledTimes(1); // yalniz READ, hic PATCH yok
  });

  it("mevcut websiteUri farkliysa PATCH gonderir - govde YALNIZ websiteUri icerir, updateMask=websiteUri", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ websiteUri: "https://eski-yanlis-link.com" }), { status: 200 })) // ilk okuma
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 })) // PATCH
      .mockResolvedValueOnce(new Response(JSON.stringify({ websiteUri: expectedGbpBookingLink("Safira") }), { status: 200 })); // read-back

    const result = await ensureGbpBookingLink("Safira", "accounts/1/locations/1");
    expect(result.action).toBe("updated");
    expect(result.verifiedUri).toBe(expectedGbpBookingLink("Safira"));

    const patchCall = fetchMock.mock.calls[1];
    expect(String(patchCall[0])).toContain("updateMask=websiteUri");
    const sentBody = JSON.parse(patchCall[1].body);
    expect(Object.keys(sentBody)).toEqual(["websiteUri"]); // BASKA HICBIR ALAN gonderilmedi (isim/adres/telefon/kategori/saat yok)
    expect(sentBody.websiteUri).toBe(expectedGbpBookingLink("Safira"));
  });

  it("PATCH sonrasi read-back beklenen degeri DOGRULAMAZSA action='blocked' doner, 'updated' YALAN SOYLEMEZ", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ websiteUri: "https://eski-link.com" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ websiteUri: "https://hala-yanlis.com" }), { status: 200 })); // read-back UYUSMUYOR

    const result = await ensureGbpBookingLink("Safira", "accounts/1/locations/1");
    expect(result.action).toBe("blocked");
    expect(result.error).toBeTruthy();
  });

  it("okuma HTTP hatasi donerse action='blocked', hicbir PATCH denenmez", async () => {
    fetchMock.mockResolvedValueOnce(new Response("error", { status: 403 }));
    const result = await ensureGbpBookingLink("Safira", "accounts/1/locations/1");
    expect(result.action).toBe("blocked");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("readGbpWebsiteUri", () => {
  it("basarili yanit icin websiteUri doner", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ websiteUri: "https://x.com" }), { status: 200 })) as unknown as typeof fetch;
    const result = await readGbpWebsiteUri("accounts/1/locations/1");
    expect(result.ok).toBe(true);
    expect(result.websiteUri).toBe("https://x.com");
  });
});
