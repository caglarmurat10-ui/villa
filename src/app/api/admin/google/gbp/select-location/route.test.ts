import { afterEach, describe, expect, it, vi } from "vitest";

let discoveryLocations: Array<{ name: string; title: string }> = [];
// Gercek KV davranisini taklit eden basit bir Map - route'un kendi read-back mantigini
// (Faz 6.1 bolum 1/2) GERCEKTEN test edebilmek icin setGbpLocationMapping ile
// getGbpLocationMapping AYNI depoyu paylasir (mock'lar birbirinden bagimsiz sahte deger
// DONDURMEZ, gercek bir KV gibi yazip okur).
const kvStore = new Map<string, { locationName: string; locationTitle: string; selectedAt: string }>();
let forceWriteException = false;
let forceReadBackMismatch = false;

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
    if (forceWriteException) throw new Error("GOOGLE_PRIVATE_NOT_CONFIGURED");
    kvStore.set(villa, { locationName, locationTitle, selectedAt: new Date().toISOString() });
  },
  getGbpLocationMapping: async (villa: string) => {
    if (forceReadBackMismatch) return null; // put "basarili" oldu ama okuma hicbir sey bulamadi - sessiz yazma hatasini simule eder
    return kvStore.get(villa) ?? null;
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
    kvStore.clear();
    forceWriteException = false;
    forceReadBackMismatch = false;
    vi.resetModules();
  });

  it("gecerli villa + gercekten kesfedilen bir location icin basarili kaydeder, persisted:true doner", async () => {
    discoveryLocations = [{ name: "accounts/1/locations/1", title: "Villa Safira Gerçek Kayıt" }];
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira", locationName: "accounts/1/locations/1" }));
    const body = await response.json() as { ok: boolean; villa: string; locationTitle: string; persisted: boolean };
    expect(response.status).toBe(200);
    expect(body.persisted).toBe(true);
    expect(body.locationTitle).toBe("Villa Safira Gerçek Kayıt");
    expect(kvStore.get("Safira")?.locationName).toBe("accounts/1/locations/1");
  });

  it("uydurma/hayali bir locationName - gercek kesif listesinde olmayan - REDDEDILIR, yazilmaz", async () => {
    discoveryLocations = [{ name: "accounts/1/locations/1", title: "Villa Safira Gerçek Kayıt" }];
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira", locationName: "accounts/999/locations/999" }));
    expect(response.status).toBe(409);
    expect(kvStore.size).toBe(0);
  });

  it("gecersiz villa degeri (Safira/Destan disinda) 400 doner", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Bilinmeyen", locationName: "accounts/1/locations/1" }));
    expect(response.status).toBe(400);
    expect(kvStore.size).toBe(0);
  });

  it("bos govde/eksik alan 400 doner, hicbir sey kaydetmez", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({}));
    expect(response.status).toBe(400);
    expect(kvStore.size).toBe(0);
  });

  // Faz 6.1 bolum 1/2 regresyonu - kullanici bir secim yaptigini bildirdi ama production'da
  // karsiligi yoktu. Kok neden kesin olarak tekrar uretilemedi, ama route artik put()'un
  // exception ATMAMASINA guvenmiyor - AYNI anahtari hemen geri okuyup dogruluyor.
  it("setGbpLocationMapping exception atarsa (ornegin KV binding erisilemez) 502 doner, ok:true YALAN SOYLEMEZ", async () => {
    discoveryLocations = [{ name: "accounts/1/locations/1", title: "Villa Safira Gerçek Kayıt" }];
    forceWriteException = true;
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira", locationName: "accounts/1/locations/1" }));
    const body = await response.json() as { error: string };
    expect(response.status).toBe(502);
    expect(body.error).toBeTruthy();
  });

  it("put() sessizce basarili donse bile read-back beklenen kaydi BULAMAZSA 502 doner - sessiz yazma hatasi artik false-positive uretmez", async () => {
    discoveryLocations = [{ name: "accounts/1/locations/1", title: "Villa Safira Gerçek Kayıt" }];
    forceReadBackMismatch = true;
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira", locationName: "accounts/1/locations/1" }));
    const body = await response.json() as { error: string; persisted?: boolean };
    expect(response.status).toBe(502);
    expect(body.persisted).toBeUndefined();
  });

  it("Safira icin yazma Destan'in mevcut kaydini etkilemez (villa izolasyonu)", async () => {
    discoveryLocations = [
      { name: "accounts/1/locations/1", title: "Villa Safira Gerçek Kayıt" },
      { name: "accounts/2/locations/2", title: "Villa Destan Gerçek Kayıt" },
    ];
    const { POST } = await import("./route");
    await POST(postRequest({ villa: "Destan", locationName: "accounts/2/locations/2" }));
    await POST(postRequest({ villa: "Safira", locationName: "accounts/1/locations/1" }));
    expect(kvStore.get("Safira")?.locationName).toBe("accounts/1/locations/1");
    expect(kvStore.get("Destan")?.locationName).toBe("accounts/2/locations/2");
  });
});
