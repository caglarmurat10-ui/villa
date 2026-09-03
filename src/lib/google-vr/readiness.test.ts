import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "../test-utils/fake-d1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");

let db: FakeD1;
const kvStore = new Map<string, string>();
const fakeKv = {
  get: async (key: string) => kvStore.get(key) ?? null,
  put: async (key: string, value: string) => { kvStore.set(key, value); },
  delete: async (key: string) => { kvStore.delete(key); },
};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db, GOOGLE_PRIVATE: fakeKv } }),
}));

function loadSchema(): string {
  return ["0001_schema.sql", "0018_price_range_base_pricing.sql"]
    .map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8"))
    .join("\n");
}

describe("getGoogleVrReadiness (gercek SQLite entegrasyon testi)", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
    kvStore.clear();
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("hicbir credential/mapping/fiyat yokken GOOGLE_VR_NOT_CONFIGURED doner, missing listesi doludur", async () => {
    const { getGoogleVrReadiness } = await import("./readiness");
    const readiness = await getGoogleVrReadiness();
    expect(readiness.state).toBe("GOOGLE_VR_NOT_CONFIGURED");
    expect(readiness.connectivity).toBe("partner_required");
    expect(readiness.missing.length).toBeGreaterThan(0);
  });

  it("her iki villa icin ayri ayri GBP mapping ve fiyat kapsami raporlar", async () => {
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO price_ranges (id, villa, start_date, end_date, nightly_rate, created_at) VALUES (?, 'Safira', '2020-01-01', '2035-12-31', 5000, ?)`,
    ).bind(crypto.randomUUID(), now).run();
    await kvStore.set("gbp:location:Safira", JSON.stringify({ locationName: "accounts/1/locations/1", locationTitle: "Villa Safira", selectedAt: now }));

    const { getGoogleVrReadiness } = await import("./readiness");
    const readiness = await getGoogleVrReadiness();
    const safira = readiness.villas.find((v) => v.villa === "Safira")!;
    const destan = readiness.villas.find((v) => v.villa === "Destan")!;

    expect(safira.gbpLocationMapped).toBe(true);
    expect(safira.priceCoverage.gapDays).toBe(0); // 2020-2035 her seyi kapsiyor
    expect(destan.gbpLocationMapped).toBe(false); // Destan icin hic mapping yapilmadi
    expect(destan.priceCoverage.gapDays).toBeGreaterThan(0); // hic fiyat yok
  });

  it("fiyat kapsami tam olsa bile GBP mapping eksikse missing listesinde bu acikca belirtilir", async () => {
    const { getGoogleVrReadiness } = await import("./readiness");
    const readiness = await getGoogleVrReadiness();
    expect(readiness.missing.some((m) => m.includes("GBP location eşlemesi"))).toBe(true);
  });
});
