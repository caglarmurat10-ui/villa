import type { D1Database } from "@cloudflare/workers-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateReservationFinancials } from "@/lib/reservationFinancials";
import type { ReservationInput } from "@/lib/schema";

type ReservationRow = {
  id: string;
  villa: "Safira" | "Destan";
  guest_name: string;
  phone: string;
  check_in: string;
  check_out: string;
  channel: "Doğrudan" | "Booking" | "Airbnb" | "Diğer";
  nightly_rate: number;
  total_amount: number;
  paid_amount: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

type PriceRow = { id: string; villa: "Safira" | "Destan"; start_date: string; end_date: string; nightly_rate: number };
type FakeStatement = { sql: string; args: unknown[]; bind: (...args: unknown[]) => FakeStatement; first: () => Promise<unknown>; all: () => Promise<{ results: unknown[] }>; run: () => Promise<{ meta: { changes: number } }> };

function fakeDatabase() {
  const state = {
    commissionRate: 20,
    row: null as ReservationRow | null,
    prices: [{ id: "price-1", villa: "Destan", start_date: "2026-09-01", end_date: "2026-09-30", nightly_rate: 1000 }] as PriceRow[],
  };
  const db = {
    prepare(sql: string) {
      const statement: FakeStatement = {
        sql,
        args: [],
        bind(...args: unknown[]) { statement.args = args; return statement; },
        async first() {
          if (sql.includes("SELECT value FROM settings")) return { value: String(state.commissionRate) };
          if (sql.includes("SELECT * FROM reservations WHERE id")) return state.row;
          if (sql.includes("SELECT id FROM reservations")) return null;
          return null;
        },
        async all() {
          if (sql.includes("FROM price_ranges")) return { results: state.prices };
          if (sql.includes("FROM reservations")) return { results: state.row ? [state.row] : [] };
          return { results: [] };
        },
        async run() { return { meta: { changes: 1 } }; },
      };
      return statement;
    },
    async batch(statements: FakeStatement[]) {
      for (const statement of statements) {
        if (statement.sql.includes("INSERT INTO reservations")) {
          const values = statement.args;
          state.row = { id: String(values[0]), villa: values[1] as ReservationRow["villa"], guest_name: String(values[2]), phone: String(values[3]),
            check_in: String(values[4]), check_out: String(values[5]), channel: values[6] as ReservationRow["channel"], nightly_rate: Number(values[7]),
            total_amount: Number(values[8]), paid_amount: Number(values[9]), notes: String(values[10]), created_at: String(values[11]), updated_at: String(values[12]) };
        }
        if (statement.sql.includes("UPDATE reservations SET villa=")) {
          const values = statement.args;
          if (!state.row) throw new Error("Test rezervasyonu bulunamadı");
          state.row = { ...state.row, villa: values[0] as ReservationRow["villa"], guest_name: String(values[1]), phone: String(values[2]),
            check_in: String(values[3]), check_out: String(values[4]), channel: values[5] as ReservationRow["channel"], nightly_rate: Number(values[6]),
            total_amount: Number(values[7]), paid_amount: Number(values[8]), notes: String(values[9]), updated_at: String(values[10]) };
        }
      }
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
  return { db: db as unknown as D1Database, state };
}

const mocks = vi.hoisted(() => ({ currentDb: null as D1Database | null }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: vi.fn(async () => ({ env: { DB: mocks.currentDb } })) }));
vi.mock("@/lib/socialOperationsDb", () => ({ revalidateAvailabilityCampaigns: vi.fn(async () => undefined) }));

import { createReservation, updateReservation } from "@/lib/db";

const input: ReservationInput = { villa: "Destan", guestName: "Test Müşteri", phone: "", checkIn: "2026-09-02", checkOut: "2026-09-05",
  channel: "Doğrudan", nightlyRate: 0, paidAmount: 0, notes: "" };

describe("rezervasyon finans hesabı", () => {
  beforeEach(() => { mocks.currentDb = null; });

  it("kuruş hassasiyetinde net = brüt - komisyon üretir", () => {
    expect(calculateReservationFinancials(1234.56, 17.5)).toEqual({ grossAmount: 1234.56, commissionRate: 17.5, commissionAmount: 216.05, netAmount: 1018.51 });
  });

  it("create mevcut settings komisyonunu otomatik uygular", async () => {
    const fake = fakeDatabase(); mocks.currentDb = fake.db;
    const created = await createReservation(input);
    expect(created).toMatchObject({ grossAmount: 3000, commissionRate: 20, commissionAmount: 600, netAmount: 2400, totalAmount: 3000 });
  });

  it("update tarih ve dönem fiyatı değişince brüt, komisyon ve neti yeniden hesaplar", async () => {
    const fake = fakeDatabase(); mocks.currentDb = fake.db;
    const created = await createReservation(input);
    fake.state.prices[0].nightly_rate = 1250;
    const updated = await updateReservation(created.id, { ...input, checkOut: "2026-09-06" });
    expect(updated).toMatchObject({ grossAmount: 5000, commissionRate: 20, commissionAmount: 1000, netAmount: 4000, nightlyRate: 1250 });
  });

  it("komisyon sıfırsa net tutarı brüte eşit bırakır", async () => {
    const fake = fakeDatabase(); fake.state.commissionRate = 0; mocks.currentDb = fake.db;
    const created = await createReservation(input);
    expect(created).toMatchObject({ grossAmount: 3000, commissionAmount: 0, netAmount: 3000 });
  });
});
