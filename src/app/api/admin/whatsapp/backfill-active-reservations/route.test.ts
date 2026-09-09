import { afterEach, describe, expect, it, vi } from "vitest";

type MockReservation = { id: string; checkOut: string; phone: string };

let reservations: MockReservation[] = [];
const syncedIds: string[] = [];
let throwForId: string | null = null;

vi.mock("@/lib/db", () => ({
  listReservations: async () => reservations,
}));

vi.mock("@/lib/whatsapp/store", () => ({
  syncCheckoutReminderForReservation: async (reservation: MockReservation) => {
    if (reservation.id === throwForId) throw new Error("simulated D1 failure");
    syncedIds.push(reservation.id);
  },
}));

describe("POST /api/admin/whatsapp/backfill-active-reservations", () => {
  afterEach(() => {
    reservations = [];
    syncedIds.length = 0;
    throwForId = null;
    vi.resetModules();
  });

  it("yalnız hâlâ aktif (checkOut >= bugün) rezervasyonlar için senkronizasyon çağırır, geçmiş rezervasyonları atlar", async () => {
    reservations = [
      { id: "future1", checkOut: "2099-09-20", phone: "0541 242 44 55" },
      { id: "past1", checkOut: "2020-01-01", phone: "0541 242 44 55" },
    ];
    const { POST } = await import("./route");
    const response = await POST();
    const data = await response.json();

    expect(syncedIds).toEqual(["future1"]);
    expect(data.activeReservationCount).toBe(1);
    expect(data.synced).toBe(1);
    expect(data.errors).toBe(0);
  });

  it("bir rezervasyonun senkronizasyonu başarısız olsa bile diğerlerini işlemeye devam eder", async () => {
    reservations = [
      { id: "ok1", checkOut: "2099-09-20", phone: "0541 242 44 55" },
      { id: "bad1", checkOut: "2099-09-21", phone: "0541 242 44 55" },
      { id: "ok2", checkOut: "2099-09-22", phone: "0541 242 44 55" },
    ];
    throwForId = "bad1";
    const { POST } = await import("./route");
    const response = await POST();
    const data = await response.json();

    expect(syncedIds).toEqual(["ok1", "ok2"]);
    expect(data.synced).toBe(2);
    expect(data.errors).toBe(1);
  });

  it("hiç aktif rezervasyon yoksa 0/0 döner, hata vermez", async () => {
    reservations = [];
    const { POST } = await import("./route");
    const response = await POST();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.activeReservationCount).toBe(0);
  });
});
