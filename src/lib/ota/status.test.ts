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

async function seedNeedsReviewBlock(villa: "Safira" | "Destan", source: "airbnb" | "booking", start: string, end: string) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO external_blocks (id, villa, source, external_uid, start_date, end_date, status, last_synced_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'needs_review', ?, ?, ?)`,
  ).bind(crypto.randomUUID(), villa, source, `uid-${crypto.randomUUID()}`, start, end, now, now, now).run();
}

async function seedReservation(villa: "Safira" | "Destan", checkIn: string, checkOut: string) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO reservations (id, villa, guest_name, check_in, check_out, channel, nightly_rate, total_amount, created_at, updated_at)
     VALUES (?, ?, 'Test Misafir', ?, ?, 'Diğer', 1000, 7000, ?, ?)`,
  ).bind(crypto.randomUUID(), villa, checkIn, checkOut, now, now).run();
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

describe("listOtaConnectionsStatus - conflictCount (FALSE POSITIVE OTA CONFLICT SEMANTICS FIX, 2026-09-03 karari)", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("needs_review blok tamamen bilinen bir rezervasyon tarafindan acikliyorsa conflictCount 0 sayilir (EXPECTED_RESERVATION_MIRROR)", async () => {
    await seedConnection("Destan", "airbnb", new Date().toISOString());
    await seedNeedsReviewBlock("Destan", "airbnb", "2026-09-07", "2026-09-11");
    await seedReservation("Destan", "2026-09-07", "2026-09-11");

    const { listOtaConnectionsStatus } = await import("./status");
    const rows = await listOtaConnectionsStatus();
    const row = rows.find((r) => r.villa === "Destan" && r.platform === "airbnb")!;
    expect(row.conflictCount).toBe(0);
  });

  it("gercek production Destan/Airbnb 3 fixture - ucu de rezervasyonla acikliyor, conflictCount 0", async () => {
    await seedConnection("Destan", "airbnb", new Date().toISOString());
    await seedNeedsReviewBlock("Destan", "airbnb", "2026-09-01", "2026-09-05");
    await seedNeedsReviewBlock("Destan", "airbnb", "2026-09-07", "2026-09-11");
    await seedNeedsReviewBlock("Destan", "airbnb", "2026-09-14", "2027-06-15");
    await seedReservation("Destan", "2026-08-31", "2026-09-05");
    await seedReservation("Destan", "2026-09-07", "2026-09-11");
    await seedReservation("Destan", "2026-09-14", "2026-09-20"); // PRE_POLICY_CONFIRMED_EXCEPTION legacy kaydi

    const { listOtaConnectionsStatus } = await import("./status");
    const rows = await listOtaConnectionsStatus();
    const row = rows.find((r) => r.villa === "Destan" && r.platform === "airbnb")!;
    expect(row.conflictCount).toBe(0);
  });

  it("needs_review blogu aciklayan hicbir rezervasyon yoksa GERCEK conflict sayilir (REVIEW_REQUIRED, conflictCount 1)", async () => {
    await seedConnection("Destan", "airbnb", new Date().toISOString());
    await seedNeedsReviewBlock("Destan", "airbnb", "2026-07-01", "2026-07-08");

    const { listOtaConnectionsStatus } = await import("./status");
    const rows = await listOtaConnectionsStatus();
    const row = rows.find((r) => r.villa === "Destan" && r.platform === "airbnb")!;
    expect(row.conflictCount).toBe(1);
  });

  it("yalniz kapali-sezon needs_review blogu (rezervasyon olmasa bile) conflictCount'a girmez", async () => {
    await seedConnection("Destan", "airbnb", new Date().toISOString());
    await seedNeedsReviewBlock("Destan", "airbnb", "2026-10-01", "2027-03-01");

    const { listOtaConnectionsStatus } = await import("./status");
    const rows = await listOtaConnectionsStatus();
    const row = rows.find((r) => r.villa === "Destan" && r.platform === "airbnb")!;
    expect(row.conflictCount).toBe(0);
  });

  it("VILLA IZOLASYONU - Safira'nin rezervasyonu Destan'in needs_review blogunu ACIKLAMAZ (yanlislikla cakisma gizlenmez)", async () => {
    await seedConnection("Destan", "airbnb", new Date().toISOString());
    await seedNeedsReviewBlock("Destan", "airbnb", "2026-07-01", "2026-07-08");
    await seedReservation("Safira", "2026-07-01", "2026-07-08");

    const { listOtaConnectionsStatus } = await import("./status");
    const rows = await listOtaConnectionsStatus();
    const row = rows.find((r) => r.villa === "Destan" && r.platform === "airbnb")!;
    expect(row.conflictCount).toBe(1);
  });

  it("active blok sayisi (activeBlockCount) mevcut normal semantikle degismeden kalir - yalniz conflictCount etkilenir", async () => {
    await seedConnection("Destan", "airbnb", new Date().toISOString());
    const now = new Date().toISOString();
    await db.prepare(`INSERT INTO external_blocks (id, villa, source, external_uid, start_date, end_date, status, last_synced_at, created_at, updated_at)
      VALUES (?, 'Destan', 'airbnb', 'uid-active', '2027-07-01', '2027-07-08', 'active', ?, ?, ?)`)
      .bind(crypto.randomUUID(), now, now, now).run();

    const { listOtaConnectionsStatus } = await import("./status");
    const rows = await listOtaConnectionsStatus();
    const row = rows.find((r) => r.villa === "Destan" && r.platform === "airbnb")!;
    expect(row.activeBlockCount).toBe(1);
    expect(row.conflictCount).toBe(0);
  });
});
