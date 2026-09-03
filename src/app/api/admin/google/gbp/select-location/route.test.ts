import { afterEach, describe, expect, it, vi } from "vitest";

let discoveryLocations: Array<{ name: string; title: string }> = [];
const savedMappings: Array<{ villa: string; locationName: string; locationTitle: string }> = [];

vi.mock("@/lib/gbp/adapter", () => ({
  discoverGbpAccountsAndLocations: async () => ({
    state: "READY_READ_ONLY",
    accounts: [],
    locations: discoveryLocations,
    error: null,
  }),
}));

vi.mock("@/lib/gbp/mapping", () => ({
  setGbpLocationMapping: async (villa: string, locationName: string, locationTitle: string) => {
    savedMappings.push({ villa, locationName, locationTitle });
  },
}));

function postRequest(body: unknown) {
  return new Request("https://admin.safiradestan.com/api/admin/google/gbp/select-location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/google/gbp/select-location (isim benzerligiyle otomatik eslestirme YOK)", () => {
  afterEach(() => {
    discoveryLocations = [];
    savedMappings.length = 0;
    vi.resetModules();
  });

  it("gecerli villa + gercekten kesfedilen bir location icin basarili kaydeder", async () => {
    discoveryLocations = [{ name: "accounts/1/locations/1", title: "Villa Safira Gerçek Kayıt" }];
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira", locationName: "accounts/1/locations/1" }));
    expect(response.status).toBe(200);
    expect(savedMappings).toEqual([{ villa: "Safira", locationName: "accounts/1/locations/1", locationTitle: "Villa Safira Gerçek Kayıt" }]);
  });

  it("uydurma/hayali bir locationName - gercek kesif listesinde olmayan - REDDEDILIR, yazilmaz", async () => {
    discoveryLocations = [{ name: "accounts/1/locations/1", title: "Villa Safira Gerçek Kayıt" }];
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira", locationName: "accounts/999/locations/999" }));
    expect(response.status).toBe(409);
    expect(savedMappings).toHaveLength(0);
  });

  it("gecersiz villa degeri (Safira/Destan disinda) 400 doner", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Bilinmeyen", locationName: "accounts/1/locations/1" }));
    expect(response.status).toBe(400);
    expect(savedMappings).toHaveLength(0);
  });

  it("bos gövde/eksik alan 400 doner, hicbir sey kaydetmez", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({}));
    expect(response.status).toBe(400);
    expect(savedMappings).toHaveLength(0);
  });
});
