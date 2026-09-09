import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createFakeD1, type FakeD1 } from "./test-utils/fake-d1";

const ROOT = resolve(__dirname, "..", "..");

function loadSchema(): string {
  return ["0001_schema.sql", "0018_price_range_base_pricing.sql"]
    .map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8"))
    .join("\n");
}

let db: FakeD1;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db } }),
}));

async function seedPriceRange(villa: "Safira" | "Destan") {
  await db.prepare(
    "INSERT INTO price_ranges (id, villa, start_date, end_date, nightly_rate, created_at) VALUES (?, ?, '2020-01-01', '2199-01-01', 1000, ?)",
  ).bind(crypto.randomUUID(), villa, new Date().toISOString()).run();
}

async function whatsappRowsFor(reservationId: string) {
  const result = await db.prepare("SELECT * FROM whatsapp_scheduled_messages WHERE reservation_id = ?").bind(reservationId).all<{ status: string; checkout_date: string; recipient_phone: string }>();
  return result.results;
}

describe("db.ts -> whatsapp/store.ts rezervasyon yaşam döngüsü senkronizasyonu (entegrasyon)", () => {
  beforeEach(async () => {
    db = createFakeD1(loadSchema());
    await seedPriceRange("Safira");
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("createReservation, geçerli telefonlu bir rezervasyon için otomatik olarak SCHEDULED bir WhatsApp hatırlatması açar", async () => {
    const { createReservation } = await import("./db");
    const reservation = await createReservation({
      villa: "Safira", guestName: "Test Misafir", phone: "0541 242 44 55",
      checkIn: "2099-09-15", checkOut: "2099-09-20", channel: "Doğrudan", nightlyRate: 1000, paidAmount: 0, notes: "",
    });

    const rows = await whatsappRowsFor(reservation.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("SCHEDULED");
    expect(rows[0].checkout_date).toBe("2099-09-20");
    expect(rows[0].recipient_phone).toBe("905412424455");
  });

  it("createReservation, telefonsuz bir rezervasyon için hiçbir hatırlatma AÇMAZ ama rezervasyonun kendisi başarıyla oluşturulur", async () => {
    const { createReservation } = await import("./db");
    const reservation = await createReservation({
      villa: "Safira", guestName: "Telefonsuz Misafir", phone: "",
      checkIn: "2099-09-15", checkOut: "2099-09-20", channel: "Doğrudan", nightlyRate: 1000, paidAmount: 0, notes: "",
    });

    expect(reservation.id).toBeTruthy();
    expect(await whatsappRowsFor(reservation.id)).toHaveLength(0);
  });

  it("updateReservation ile çıkış tarihi değişirse: eski satır CANCELLED olur, yeni tarih için SCHEDULED satır açılır", async () => {
    const { createReservation, updateReservation } = await import("./db");
    const reservation = await createReservation({
      villa: "Safira", guestName: "Test Misafir", phone: "0541 242 44 55",
      checkIn: "2099-09-15", checkOut: "2099-09-20", channel: "Doğrudan", nightlyRate: 1000, paidAmount: 0, notes: "",
    });

    await updateReservation(reservation.id, {
      villa: "Safira", guestName: "Test Misafir", phone: "0541 242 44 55",
      checkIn: "2099-09-15", checkOut: "2099-09-27", channel: "Doğrudan", nightlyRate: 1000, paidAmount: 0, notes: "",
    });

    const rows = await whatsappRowsFor(reservation.id);
    expect(rows.find((r) => r.checkout_date === "2099-09-20")?.status).toBe("CANCELLED");
    expect(rows.find((r) => r.checkout_date === "2099-09-27")?.status).toBe("SCHEDULED");
  });

  it("updateReservationPhone, bekleyen hatırlatmanın recipient_phone'unu günceller", async () => {
    const { createReservation, updateReservationPhone } = await import("./db");
    const reservation = await createReservation({
      villa: "Safira", guestName: "Test Misafir", phone: "0541 242 44 55",
      checkIn: "2099-09-15", checkOut: "2099-09-20", channel: "Doğrudan", nightlyRate: 1000, paidAmount: 0, notes: "",
    });

    await updateReservationPhone(reservation.id, "0532 111 22 33");

    const rows = await whatsappRowsFor(reservation.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].recipient_phone).toBe("905321112233");
  });

  it("softDeleteReservation (iptal), bekleyen hatırlatmayı CANCELLED yapar", async () => {
    const { createReservation, softDeleteReservation } = await import("./db");
    const reservation = await createReservation({
      villa: "Safira", guestName: "Test Misafir", phone: "0541 242 44 55",
      checkIn: "2099-09-15", checkOut: "2099-09-20", channel: "Doğrudan", nightlyRate: 1000, paidAmount: 0, notes: "",
    });

    await softDeleteReservation(reservation.id);

    const rows = await whatsappRowsFor(reservation.id);
    expect(rows[0].status).toBe("CANCELLED");
  });
});
