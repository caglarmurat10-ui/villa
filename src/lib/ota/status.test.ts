import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "../test-utils/fake-d1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");

function loadSchema(): string {
  return ["0001_schema.sql", "0011_ota_calendar_sync.sql"]
    .map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8"))
    .join("\n");
}

let db: FakeD1;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db } }),
}));

async function seedConnection(villa: "Safira" | "Destan", platform: "airbnb" | "booking", lastSuccessAt: string | null) {
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT INTO ota_connections (id, villa, platform, is_enabled, last_synced_at, last_success_at, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), villa, platform, lastSuccessAt, lastSuccessAt, now, now).run();
}

describe("listOtaConnectionsStatus - healthScore/anomalyCount (gercek SQLite entegrasyon testi)", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("son sync cok yeniyse (yesil pencere) healthScore=100, hicbir ceza yok", async () => {
    await seedConnection("Safira", "airbnb", new Date().toISOString());
    const { listOtaConnectionsStatus } = await import("./status");
    const rows = await listOtaConnectionsStatus();
    const row = rows.find((r) => r.villa === "Safira" && r.platform === "airbnb")!;
    expect(row.health).toBe("green");
    expect(row.healthScore).toBe(100);
    expect(row.anomalyCount).toBe(0);
  });

  it("hic baglanti yoksa healthScore=0, health=pending", async () => {
    const { listOtaConnectionsStatus } = await import("./status");
    const rows = await listOtaConnectionsStatus();
    const row = rows.find((r) => r.villa === "Destan" && r.platform === "booking")!;
    expect(row.connected).toBe(false);
    expect(row.healthScore).toBe(0);
    expect(row.health).toBe("pending");
  });

  it("son 30 gundeki ANOMALOUS_BLOCK_DETECTED kayitlari villa+platform bazinda dogru sayilir", async () => {
    await seedConnection("Safira", "airbnb", new Date().toISOString());
    const now = new Date().toISOString();
    // iki farkli villa/platform icin anomali kaydi - yalniz Safira/airbnb'ninki sayilmali
    await db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES ('Safira', 'ANOMALOUS_BLOCK_DETECTED', ?, ?)")
      .bind(JSON.stringify({ villa: "Safira", source: "airbnb" }), now).run();
    await db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES ('Safira', 'ANOMALOUS_BLOCK_DETECTED', ?, ?)")
      .bind(JSON.stringify({ villa: "Safira", source: "booking" }), now).run();
    await db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES ('Destan', 'ANOMALOUS_BLOCK_DETECTED', ?, ?)")
      .bind(JSON.stringify({ villa: "Destan", source: "airbnb" }), now).run();

    const { listOtaConnectionsStatus } = await import("./status");
    const rows = await listOtaConnectionsStatus();
    const safiraAirbnb = rows.find((r) => r.villa === "Safira" && r.platform === "airbnb")!;
    const safiraBooking = rows.find((r) => r.villa === "Safira" && r.platform === "booking")!;
    expect(safiraAirbnb.anomalyCount).toBe(1);
    expect(safiraBooking.anomalyCount).toBe(1);
    expect(safiraAirbnb.healthScore).toBeLessThan(100); // anomali cezasi uygulandi
  });

  it("30 gunden eski anomali kayitlari sayilmaz (pencere disinda)", async () => {
    await seedConnection("Safira", "airbnb", new Date().toISOString());
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES ('Safira', 'ANOMALOUS_BLOCK_DETECTED', ?, ?)")
      .bind(JSON.stringify({ villa: "Safira", source: "airbnb" }), old).run();

    const { listOtaConnectionsStatus } = await import("./status");
    const rows = await listOtaConnectionsStatus();
    const row = rows.find((r) => r.villa === "Safira" && r.platform === "airbnb")!;
    expect(row.anomalyCount).toBe(0);
  });
});
