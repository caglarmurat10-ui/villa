// Faz 5 son denetim düzeltmesi - public booking inquiry artık TEK canonical price-engine.ts
// kaynağını kullanıyor (eski quoteForDates matematiği kaldırıldı). Bu test dosyası bunu gerçek
// SQLite semantiğiyle (fake-d1) uçtan uca doğrular - customer-price-invariant.test.ts ile aynı desen.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "./test-utils/fake-d1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

let db: FakeD1;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db } }),
}));

function loadSchema(): string {
  return ["0001_schema.sql", "0011_ota_calendar_sync.sql", "0018_price_range_base_pricing.sql"]
    .map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8"))
    .join("\n");
}

async function seedDestan2027Price() {
  await db.prepare(`INSERT INTO price_ranges (id, villa, start_date, end_date, nightly_rate, base_nights, base_price_minor, minimum_nights, created_at)
    VALUES ('p-destan-2027', 'Destan', '2027-06-15', '2027-09-15', 18571.43, 7, 13000000, 4, ?)`).bind(new Date().toISOString()).run();
}

async function seedSafira2027Price() {
  await db.prepare(`INSERT INTO price_ranges (id, villa, start_date, end_date, nightly_rate, base_nights, base_price_minor, minimum_nights, created_at)
    VALUES ('p-safira-2027', 'Safira', '2027-06-15', '2027-09-15', 15714.29, 7, 11000000, 4, ?)`).bind(new Date().toISOString()).run();
}

const BASE_INPUT = { guestName: "Test Misafir", phone: "05551234567", guestCount: 2, note: "" };

describe("createBookingInquiry (public inquiry - canonical price engine + min stay + OTA guard)", () => {
  beforeEach(async () => {
    db = createFakeD1(loadSchema());
    await seedDestan2027Price();
    await seedSafira2027Price();
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("Destan 7 gece quote TAM 130000.00 - canonical engine kaynaklı, eski nightly_rate x gece degil", async () => {
    const { createBookingInquiry } = await import("./booking-inquiries");
    const result = await createBookingInquiry({ ...BASE_INPUT, villa: "Destan", checkIn: "2027-06-15", checkOut: "2027-06-22" });
    expect(result.inquiry.quotedTotal).toBe(130000);
    expect(result.inquiry.quotedNights).toBe(7);
  });

  it("Safira 7 gece quote TAM 110000.00", async () => {
    const { createBookingInquiry } = await import("./booking-inquiries");
    const result = await createBookingInquiry({ ...BASE_INPUT, villa: "Safira", checkIn: "2027-06-15", checkOut: "2027-06-22" });
    expect(result.inquiry.quotedTotal).toBe(110000);
    expect(result.inquiry.quotedNights).toBe(7);
  });

  it("Destan 3 gece (2027 yaz donemi) REDDEDILIR - minimum konaklama mesaji", async () => {
    const { createBookingInquiry, BookingInquiryConflictError } = await import("./booking-inquiries");
    await expect(createBookingInquiry({ ...BASE_INPUT, villa: "Destan", checkIn: "2027-06-15", checkOut: "2027-06-18" }))
      .rejects.toBeInstanceOf(BookingInquiryConflictError);
    try {
      await createBookingInquiry({ ...BASE_INPUT, villa: "Destan", checkIn: "2027-06-15", checkOut: "2027-06-18" });
    } catch (error) {
      expect((error as Error).message).toBe("Bu dönem için minimum konaklama süresi 4 gecedir.");
    }
  });

  it("Safira 3 gece REDDEDILIR", async () => {
    const { createBookingInquiry, BookingInquiryConflictError } = await import("./booking-inquiries");
    await expect(createBookingInquiry({ ...BASE_INPUT, villa: "Safira", checkIn: "2027-06-15", checkOut: "2027-06-18" }))
      .rejects.toBeInstanceOf(BookingInquiryConflictError);
  });

  it("4 gece kabul edilir (minimum tam karsilaniyor)", async () => {
    const { createBookingInquiry } = await import("./booking-inquiries");
    const result = await createBookingInquiry({ ...BASE_INPUT, villa: "Destan", checkIn: "2027-06-15", checkOut: "2027-06-19" });
    expect(result.inquiry.quotedNights).toBe(4);
    expect(result.inquiry.quotedTotal).toBe(Math.round((13000000 * 4) / 7) / 100);
  });

  it("fiyati tanimsiz (gap) donem icin inquiry yine de olusturulur, quotedTotal null kalir (uydurma yok)", async () => {
    const { createBookingInquiry } = await import("./booking-inquiries");
    const result = await createBookingInquiry({ ...BASE_INPUT, villa: "Destan", checkIn: "2028-01-01", checkOut: "2028-01-08" });
    expect(result.inquiry.quotedTotal).toBeNull();
    expect(result.duplicate).toBe(false);
  });

  it("GERCEK active OTA blogu ile cakisan tarih REDDEDILIR", async () => {
    const now = new Date().toISOString();
    await db.prepare(`INSERT INTO external_blocks (id, villa, source, external_uid, start_date, end_date, status, last_synced_at, created_at, updated_at)
      VALUES ('b1', 'Destan', 'airbnb', 'uid-1', '2027-06-16', '2027-06-20', 'active', ?, ?, ?)`).bind(now, now, now).run();
    const { createBookingInquiry, BookingInquiryConflictError } = await import("./booking-inquiries");
    await expect(createBookingInquiry({ ...BASE_INPUT, villa: "Destan", checkIn: "2027-06-15", checkOut: "2027-06-22" }))
      .rejects.toBeInstanceOf(BookingInquiryConflictError);
  });

  it("needs_review (dogrulanmamis) OTA blogu public musteriyi BLOKLAMAZ - mevcut public calendar davranisiyla ayni", async () => {
    const now = new Date().toISOString();
    await db.prepare(`INSERT INTO external_blocks (id, villa, source, external_uid, start_date, end_date, status, last_synced_at, created_at, updated_at)
      VALUES ('b2', 'Destan', 'airbnb', 'uid-2', '2027-06-16', '2027-06-20', 'needs_review', ?, ?, ?)`).bind(now, now, now).run();
    const { createBookingInquiry } = await import("./booking-inquiries");
    const result = await createBookingInquiry({ ...BASE_INPUT, villa: "Destan", checkIn: "2027-06-15", checkOut: "2027-06-22" });
    expect(result.inquiry.quotedTotal).toBe(130000);
  });
});

describe("convertBookingInquiryToReservation (admin conversion - canonical total, min-stay override, final OTA check)", () => {
  beforeEach(async () => {
    db = createFakeD1(loadSchema());
    await seedDestan2027Price();
    await seedSafira2027Price();
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("donusum canonical toplami kullanir - eski nightly-rate x gece surklenmesi yok", async () => {
    const { createBookingInquiry, convertBookingInquiryToReservation } = await import("./booking-inquiries");
    const created = await createBookingInquiry({ ...BASE_INPUT, villa: "Destan", checkIn: "2027-06-15", checkOut: "2027-06-22" });
    const result = await convertBookingInquiryToReservation(created.inquiry.id);
    expect(result?.alreadyConverted).toBe(false);
    const row = await db.prepare("SELECT total_amount FROM reservations WHERE id = ?").bind(result!.reservationId).first<{ total_amount: number }>();
    expect(row?.total_amount).toBe(130000);
  });

  it("admin bilincli olarak 3 gecelik (minimum-altinda) bir inquiry'i donusturebilir (personel override) - fiyat yine canonical", async () => {
    // Once normal (4+ gece) bir inquiry olusturulur (booking_inquiries tablosunu da hazirlar),
    // sonra "eski/bilinen" 3 gecelik bir talebi simule etmek icin dogrudan D1'de tarihler
    // kisaltilir - admin conversion'in min-stay'i BLOKLAMADIGINI ama fiyati DOGRU (canonical)
    // hesapladigini dogrulamak icin.
    const { createBookingInquiry, convertBookingInquiryToReservation } = await import("./booking-inquiries");
    const created = await createBookingInquiry({ ...BASE_INPUT, villa: "Destan", checkIn: "2027-06-15", checkOut: "2027-06-19" });
    await db.prepare("UPDATE booking_inquiries SET check_out = '2027-06-18', quoted_nights = 3 WHERE id = ?").bind(created.inquiry.id).run();

    const result = await convertBookingInquiryToReservation(created.inquiry.id);
    expect(result?.alreadyConverted).toBe(false);
    const row = await db.prepare("SELECT total_amount FROM reservations WHERE id = ?").bind(result!.reservationId).first<{ total_amount: number }>();
    expect(row?.total_amount).toBe(Math.round((13000000 * 3) / 7) / 100);
  });

  it("donusum sirasinda GERCEK active OTA cakismasi varsa reddedilir (son kontrol)", async () => {
    const { createBookingInquiry, convertBookingInquiryToReservation, BookingInquiryConversionError } = await import("./booking-inquiries");
    const created = await createBookingInquiry({ ...BASE_INPUT, villa: "Destan", checkIn: "2027-06-15", checkOut: "2027-06-22" });
    const now = new Date().toISOString();
    // Talep olusturulduktan SONRA yeni bir OTA senkronu bu tarihi aktif blokladi.
    await db.prepare(`INSERT INTO external_blocks (id, villa, source, external_uid, start_date, end_date, status, last_synced_at, created_at, updated_at)
      VALUES ('b3', 'Destan', 'airbnb', 'uid-3', '2027-06-16', '2027-06-20', 'active', ?, ?, ?)`).bind(now, now, now).run();
    await expect(convertBookingInquiryToReservation(created.inquiry.id)).rejects.toBeInstanceOf(BookingInquiryConversionError);
  });
});
