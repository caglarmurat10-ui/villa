// Faz "Villa Destan OTA Kapatma" bölüm 5/6/13 - export.ts'in cross-channel blocking + feedback-loop
// prevention davranışını gerçek SQLite semantiğiyle doğrular. Bu dosya şimdiye kadar HİÇ yoktu -
// buildExportEvents'in davranışı yalnız kod okumasıyla doğrulanmıştı, gerçek bir teste hiç dayanmıyordu.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "../test-utils/fake-d1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");

let db: FakeD1;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db } }),
}));

function loadSchema(): string {
  return ["0001_schema.sql", "0011_ota_calendar_sync.sql"].map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8")).join("\n");
}

async function insertReservation(villa: "Safira" | "Destan", checkIn: string, checkOut: string, guestName = "Gerçek Misafir") {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO reservations (id, villa, guest_name, check_in, check_out, channel, nightly_rate, total_amount, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'Doğrudan', 1000, 7000, ?, ?)`,
  ).bind(id, villa, guestName, checkIn, checkOut, now, now).run();
  return id;
}

async function insertBlock(villa: "Safira" | "Destan", source: "airbnb" | "booking", start: string, end: string, status: "active" | "needs_review" | "removed" = "active") {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO external_blocks (id, villa, source, external_uid, start_date, end_date, status, last_synced_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, villa, source, `uid-${id}`, start, end, status, now, now, now).run();
  return id;
}

describe("buildExportEvents - Villa Destan cross-channel blocking + feedback-loop prevention", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("Senaryo A - first-party Destan rezervasyonu HEM Airbnb HEM Booking export feed'inde gorunur", async () => {
    await insertReservation("Destan", "2027-07-01", "2027-07-08");
    const { buildExportEvents } = await import("./export");

    const airbnbFeed = await buildExportEvents("Destan", "airbnb");
    const bookingFeed = await buildExportEvents("Destan", "booking");

    expect(airbnbFeed).toHaveLength(1);
    expect(bookingFeed).toHaveLength(1);
    expect(airbnbFeed[0].startDate).toBe("2027-07-01");
    expect(bookingFeed[0].startDate).toBe("2027-07-01");
  });

  it("Senaryo B - Airbnb'den import edilen aktif blok Booking export feed'inde gorunur AMA Airbnb export feed'ine GERI GONDERILMEZ (feedback-loop onlenir)", async () => {
    await insertBlock("Destan", "airbnb", "2027-07-10", "2027-07-15", "active");
    const { buildExportEvents } = await import("./export");

    const bookingFeed = await buildExportEvents("Destan", "booking");
    const airbnbFeed = await buildExportEvents("Destan", "airbnb");

    expect(bookingFeed).toHaveLength(1); // cross-channel block calisiyor
    expect(airbnbFeed).toHaveLength(0); // feedback-loop onlendi
  });

  it("Senaryo C - Booking'den import edilen aktif blok Airbnb export feed'inde gorunur AMA Booking export feed'ine GERI GONDERILMEZ", async () => {
    await insertBlock("Destan", "booking", "2027-07-20", "2027-07-25", "active");
    const { buildExportEvents } = await import("./export");

    const airbnbFeed = await buildExportEvents("Destan", "airbnb");
    const bookingFeed = await buildExportEvents("Destan", "booking");

    expect(airbnbFeed).toHaveLength(1);
    expect(bookingFeed).toHaveLength(0);
  });

  it("needs_review durumundaki bir blok da (henuz insan onayi beklese bile) cift-rezervasyonu onlemek icin export feed'inde gorunur - yalniz PUBLIC site'ta gizlenir, OTA export'ta DEGIL", async () => {
    await insertBlock("Destan", "airbnb", "2027-08-01", "2027-08-05", "needs_review");
    const { buildExportEvents } = await import("./export");

    const bookingFeed = await buildExportEvents("Destan", "booking");
    expect(bookingFeed).toHaveLength(1);
  });

  it("status='removed' (iptal edilmis) bir blok hicbir export feed'inde GORUNMEZ", async () => {
    await insertBlock("Destan", "airbnb", "2027-08-10", "2027-08-15", "removed");
    const { buildExportEvents } = await import("./export");

    const bookingFeed = await buildExportEvents("Destan", "booking");
    expect(bookingFeed).toHaveLength(0);
  });

  it("export event'leri yalniz UID/tarih icerir - misafir adi/telefon/fiyat/not ASLA disari sizmaz (PII yok)", async () => {
    await insertReservation("Destan", "2027-07-01", "2027-07-08", "Gizli Ad Soyad");
    const { buildExportEvents } = await import("./export");
    const events = await buildExportEvents("Destan", "airbnb");

    expect(events).toHaveLength(1);
    expect(Object.keys(events[0]).sort()).toEqual(["endDate", "startDate", "uid"]);
    expect(JSON.stringify(events[0])).not.toContain("Gizli Ad Soyad");
  });

  it("VILLA IZOLASYONU - Safira'nin rezervasyon/bloklari Destan export feed'ine HICBIR ZAMAN karismaz", async () => {
    await insertReservation("Safira", "2027-07-01", "2027-07-08");
    await insertBlock("Safira", "booking", "2027-07-10", "2027-07-15", "active");
    await insertReservation("Destan", "2027-09-01", "2027-09-08");
    const { buildExportEvents } = await import("./export");

    const destanFeed = await buildExportEvents("Destan", "airbnb");
    expect(destanFeed).toHaveLength(1);
    expect(destanFeed[0].startDate).toBe("2027-09-01");
  });

  it("LEGACY CONFIRMED RESERVATION EXCEPTIONS - kapali sezona tasan, policy-oncesi (grandfathered) bir rezervasyon YINE DE export feed'inde gorunur (Airbnb/Booking = BLOCKED) - buildExportEvents sezon politikasina hic bakmaz, yalniz deleted_at'a bakar", async () => {
    // Gercek bf26c751-... senaryosu: Safira 2026-09-22 -> 2026-09-27, yeni yillik kuralda kapali
    // sezona tasiyor ama grandfathered oldugu icin silinmedi - export/availability blocking bunun
    // "sezon disi" olmasindan tamamen bagimsiz calisir, sadece rezervasyon var mi diye bakar.
    await insertReservation("Safira", "2026-09-22", "2026-09-27");
    const { buildExportEvents } = await import("./export");

    const airbnbFeed = await buildExportEvents("Safira", "booking");
    const bookingFeed = await buildExportEvents("Safira", "airbnb");
    expect(airbnbFeed).toHaveLength(1);
    expect(bookingFeed).toHaveLength(1);
  });

  it("SIRADAN kapali sezon tarihli bir rezervasyon da (grandfathered olsun olmasin) ayni sekilde export feed'inde gorunur - kapali sezon zaten unavailable, ama rezervasyon gercegi audit trail'de korunur", async () => {
    await insertReservation("Destan", "2027-10-01", "2027-10-08");
    const { buildExportEvents } = await import("./export");

    const airbnbFeed = await buildExportEvents("Destan", "booking");
    expect(airbnbFeed).toHaveLength(1);
    expect(airbnbFeed[0].startDate).toBe("2027-10-01");
  });

  it("silinmis (deleted_at dolu) bir rezervasyon export feed'inde GORUNMEZ", async () => {
    const id = await insertReservation("Destan", "2027-07-01", "2027-07-08");
    await db.prepare("UPDATE reservations SET deleted_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    const { buildExportEvents } = await import("./export");

    const events = await buildExportEvents("Destan", "airbnb");
    expect(events).toHaveLength(0);
  });
});
