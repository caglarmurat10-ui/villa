import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildScoutQueries, parseSearchResultsToCandidates, runPublicWebScout, TARGET_LOCATIONS } from "./social-growth-public-scout";

vi.mock("./social-growth-store", () => ({
  upsertProspect: vi.fn(async (input: unknown) => ({ ...(input as object), id: "fake-id" })),
}));

describe("buildScoutQueries", () => {
  it("istenen sayıda sorgu üretir ve imleci ilerletir", () => {
    const { queries, nextCursor } = buildScoutQueries(0, 5);
    expect(queries).toHaveLength(5);
    expect(nextCursor).toBe(5);
  });

  it("matrisin sonuna gelince başa sarar (round-robin)", () => {
    const totalCombos = TARGET_LOCATIONS.length * 8; // 8 kategori
    const { queries, nextCursor } = buildScoutQueries(totalCombos - 2, 5);
    expect(queries).toHaveLength(5);
    expect(nextCursor).toBe(3);
  });

  it("her sorgu bir hedef lokasyon içerir", () => {
    const { queries } = buildScoutQueries(0, 3);
    for (const query of queries) {
      expect(TARGET_LOCATIONS).toContain(query.location);
      expect(query.q).toContain(query.location);
    }
  });
});

describe("parseSearchResultsToCandidates", () => {
  it("instagram.com profil linklerinden username çıkarır", () => {
    const items = [
      { title: "Kaş Gezgini", link: "https://www.instagram.com/kas_gezgini/", snippet: "Patara ve Kaş gezi rehberi" },
    ];
    const result = parseSearchResultsToCandidates(items, "travel_creator", "Kaş");
    expect(result).toHaveLength(1);
    expect(result[0]?.username).toBe("kas_gezgini");
    expect(result[0]?.profileUrl).toBe("https://www.instagram.com/kas_gezgini/");
  });

  it("gönderi/reel linklerini profil sanıp yanlış username çıkarmaz", () => {
    const items = [
      { link: "https://www.instagram.com/p/Cxyz123/" },
      { link: "https://www.instagram.com/reel/Cabc456/" },
      { link: "https://www.instagram.com/explore/tags/kas/" },
    ];
    expect(parseSearchResultsToCandidates(items, "travel_creator", "Kaş")).toEqual([]);
  });

  it("instagram.com olmayan linkleri yok sayar", () => {
    const items = [{ link: "https://www.facebook.com/kasgezgini" }, { link: "https://example.com/kas" }];
    expect(parseSearchResultsToCandidates(items, "travel_creator", "Kaş")).toEqual([]);
  });

  it("aynı username'i tek bir çalıştırmada tekrar eklemez", () => {
    const items = [
      { link: "https://www.instagram.com/kas_gezgini/" },
      { link: "https://www.instagram.com/kas_gezgini/?hl=tr" },
    ];
    expect(parseSearchResultsToCandidates(items, "travel_creator", "Kaş")).toHaveLength(1);
  });

  it("bozuk URL'leri sessizce atlar, çökmez", () => {
    const items = [{ link: "not a url" }, { link: "" }];
    expect(() => parseSearchResultsToCandidates(items as never, "travel_creator", "Kaş")).not.toThrow();
  });
});

describe("runPublicWebScout", () => {
  const fakeKv = { get: vi.fn(async () => null), put: vi.fn(async () => undefined) };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    fakeKv.get.mockClear();
    fakeKv.put.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("SOCIAL_SCOUT_SEARCH_API_KEY tanımlı değilse hiçbir dış istek atmadan configured:false döner", async () => {
    const result = await runPublicWebScout({ META_PRIVATE: fakeKv as never });
    expect(result.configured).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("anahtar tanımlıysa Google Custom Search'e istek atar ve adayları ekler", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ link: "https://www.instagram.com/kas_gezgini/", snippet: "Patara gezi rehberi" }] }),
    });
    const result = await runPublicWebScout({
      META_PRIVATE: fakeKv as never,
      SOCIAL_SCOUT_SEARCH_API_KEY: "test-key",
      SOCIAL_SCOUT_SEARCH_ENGINE_ID: "test-engine",
    });
    expect(result.configured).toBe(true);
    if (result.configured) {
      expect(result.inserted).toBeGreaterThan(0);
    }
    expect(fakeKv.put).toHaveBeenCalled();
  });

  it("dailyCap'e ulaşınca yeni sorgu atmayı durdurur", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: Array.from({ length: 10 }, (_, i) => ({ link: `https://www.instagram.com/user_${i}_x/` })),
      }),
    });
    const result = await runPublicWebScout({
      META_PRIVATE: fakeKv as never,
      SOCIAL_SCOUT_SEARCH_API_KEY: "test-key",
      SOCIAL_SCOUT_SEARCH_ENGINE_ID: "test-engine",
    }, 3);
    expect(result.configured).toBe(true);
    if (result.configured) expect(result.inserted).toBeLessThanOrEqual(3);
  });

  it("bir sorgu hata verirse diğerlerini denemeye devam eder, çökmez", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    const result = await runPublicWebScout({
      META_PRIVATE: fakeKv as never,
      SOCIAL_SCOUT_SEARCH_API_KEY: "test-key",
      SOCIAL_SCOUT_SEARCH_ENGINE_ID: "test-engine",
    });
    expect(result.configured).toBe(true);
    if (result.configured) expect(result.errors).toBeGreaterThanOrEqual(1);
  });
});
