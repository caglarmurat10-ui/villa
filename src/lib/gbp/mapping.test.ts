import { afterEach, describe, expect, it, vi } from "vitest";

const kvStore = new Map<string, string>();

const fakeKv = {
  get: async (key: string) => kvStore.get(key) ?? null,
  put: async (key: string, value: string) => { kvStore.set(key, value); },
  delete: async (key: string) => { kvStore.delete(key); },
};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { GOOGLE_PRIVATE: fakeKv } }),
}));

describe("GBP location mapping (yalniz acikca secilen deger yazilir)", () => {
  afterEach(() => {
    kvStore.clear();
    vi.resetModules();
  });

  it("hicbir eslesme yokken null doner - otomatik/varsayilan bir deger UYDURULMAZ", async () => {
    const { getGbpLocationMapping } = await import("./mapping");
    expect(await getGbpLocationMapping("Safira")).toBeNull();
    expect(await getGbpLocationMapping("Destan")).toBeNull();
  });

  it("setGbpLocationMapping yalniz cagrildigi villa icin yazar, digerini etkilemez", async () => {
    const { getGbpLocationMapping, setGbpLocationMapping } = await import("./mapping");
    await setGbpLocationMapping("Safira", "accounts/1/locations/1", "Villa Safira Location");
    const safira = await getGbpLocationMapping("Safira");
    const destan = await getGbpLocationMapping("Destan");
    expect(safira?.locationName).toBe("accounts/1/locations/1");
    expect(safira?.locationTitle).toBe("Villa Safira Location");
    expect(destan).toBeNull(); // Destan icin ayri, bagimsiz secim gerekir - otomatik kopyalanmaz
  });

  it("clearGbpLocationMapping eslesmeyi kaldirir", async () => {
    const { getGbpLocationMapping, setGbpLocationMapping, clearGbpLocationMapping } = await import("./mapping");
    await setGbpLocationMapping("Destan", "accounts/1/locations/2", "Villa Destan Location");
    expect(await getGbpLocationMapping("Destan")).not.toBeNull();
    await clearGbpLocationMapping("Destan");
    expect(await getGbpLocationMapping("Destan")).toBeNull();
  });

  it("getAllGbpLocationMappings her iki villayi da dogru anahtarla doner", async () => {
    const { getAllGbpLocationMappings, setGbpLocationMapping } = await import("./mapping");
    await setGbpLocationMapping("Safira", "accounts/1/locations/1", "Safira Loc");
    const all = await getAllGbpLocationMappings();
    expect(all.Safira?.locationName).toBe("accounts/1/locations/1");
    expect(all.Destan).toBeNull();
  });
});
