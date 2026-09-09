import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "./test-utils/fake-d1";
import { MAP_PLATFORMS } from "./map-presence";
import { MAP_PLATFORM_INFO, buildSubmissionPacket } from "./map-presence-content";

let db: FakeD1;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db } }),
}));

describe("listMapPresence / setMapPresenceStatus", () => {
  beforeEach(() => {
    db = createFakeD1("");
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("hiç kayıt yokken 2 villa × 7 platform = 14 NOT_CHECKED satırı döner (önceden seed gerekmez)", async () => {
    const { listMapPresence } = await import("./map-presence");
    const rows = await listMapPresence();
    expect(rows).toHaveLength(14);
    expect(rows.every((r) => r.status === "NOT_CHECKED")).toBe(true);
  });

  it("tüm 7 harita platformu (GOOGLE/APPLE/YANDEX/HERE/TOMTOM/OPENSTREETMAP/GARMIN) her villa için mevcut", async () => {
    const { listMapPresence } = await import("./map-presence");
    const rows = await listMapPresence();
    for (const villa of ["Safira", "Destan"] as const) {
      const platforms = rows.filter((r) => r.villa === villa).map((r) => r.platform).sort();
      expect(platforms).toEqual([...MAP_PLATFORMS].sort());
    }
  });

  it("setMapPresenceStatus bir durumu günceller, listMapPresence bunu yansıtır", async () => {
    const { listMapPresence, setMapPresenceStatus } = await import("./map-presence");
    await setMapPresenceStatus("Destan", "APPLE", "CLAIM_STARTED", "Apple Business Connect üzerinden başvuru yapıldı");
    const rows = await listMapPresence();
    const destanApple = rows.find((r) => r.villa === "Destan" && r.platform === "APPLE");
    expect(destanApple?.status).toBe("CLAIM_STARTED");
    expect(destanApple?.note).toContain("Apple Business Connect");
  });

  it("aynı (villa, platform) için ikinci bir set çağrısı ÜZERİNE YAZAR (yeni satır oluşturmaz)", async () => {
    const { listMapPresence, setMapPresenceStatus } = await import("./map-presence");
    await setMapPresenceStatus("Safira", "GOOGLE", "VERIFIED");
    await setMapPresenceStatus("Safira", "GOOGLE", "BLOCKED", "Meta ile ilgisiz, ayrı bir dış kısıtlama");
    const rows = await listMapPresence();
    const safiraGoogle = rows.filter((r) => r.villa === "Safira" && r.platform === "GOOGLE");
    expect(safiraGoogle).toHaveLength(1);
    expect(safiraGoogle[0].status).toBe("BLOCKED");
  });

  it("bu modül hiçbir dış API'ye fetch çağrısı yapmaz - yalnız D1 durumu (kod incelemesi ile doğrulanan bir kontrat, burada dolaylı olarak modülün yalnız D1'e bağımlı olduğu doğrulanır)", async () => {
    const { setMapPresenceStatus } = await import("./map-presence");
    // Gerçek bir dış istek yapılsaydı bu test ortamı (fetch mocklanmadı) hata fırlatırdı/asılı kalırdı.
    const result = await setMapPresenceStatus("Destan", "OPENSTREETMAP", "ADDITION_SUBMITTED");
    expect(result.status).toBe("ADDITION_SUBMITTED");
  });
});

describe("buildSubmissionPacket (map-presence-content, saf/D1'siz)", () => {
  it("Destan için her platform paketi addressWarning taşır (30 vs 30/1 belirsizliği doğrulanana kadar)", () => {
    for (const platform of MAP_PLATFORMS) {
      const packet = buildSubmissionPacket("Destan", platform);
      expect(packet.addressWarning).not.toBeNull();
      expect(packet.addressWarning).toContain("No:30/1");
    }
  });

  it("Safira için hiçbir platform paketi addressWarning taşımaz (adres belirsizliği yok)", () => {
    for (const platform of MAP_PLATFORMS) {
      const packet = buildSubmissionPacket("Safira", platform);
      expect(packet.addressWarning).toBeNull();
    }
  });

  it("her platformun paketi gerçek işletme adı/telefon/website taşır, hiçbiri boş değil", () => {
    for (const villa of ["Safira", "Destan"] as const) {
      for (const platform of MAP_PLATFORMS) {
        const packet = buildSubmissionPacket(villa, platform);
        expect(packet.businessName.length).toBeGreaterThan(0);
        expect(packet.address.length).toBeGreaterThan(0);
        expect(packet.phone.length).toBeGreaterThan(0);
        expect(packet.website).toBe("https://safiradestan.com");
      }
    }
  });

  it("7 platformun tamamı MAP_PLATFORM_INFO içinde https:// ile başlayan gerçek bir officialUrl taşır", () => {
    for (const platform of MAP_PLATFORMS) {
      expect(MAP_PLATFORM_INFO[platform].officialUrl.startsWith("https://")).toBe(true);
      expect(MAP_PLATFORM_INFO[platform].processSummary.length).toBeGreaterThan(0);
    }
  });

  it("TomTom ve Garmin bilinen kısıtlamalarını (Türkiye desteği/doğrudan kanal yok) gizlemeden limitationNote alanında taşır", () => {
    expect(MAP_PLATFORM_INFO.TOMTOM.limitationNote).toContain("Türkiye");
    expect(MAP_PLATFORM_INFO.GARMIN.limitationNote).not.toBeNull();
  });
});
