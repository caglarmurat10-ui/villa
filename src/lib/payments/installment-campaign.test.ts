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
  return ["0001_schema.sql", "0012_payments.sql", "0013_payments_active_guard.sql"]
    .map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8"))
    .join("\n");
}

async function seedReservation(id: string) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO reservations (id, villa, guest_name, check_in, check_out, channel, nightly_rate, total_amount, created_at, updated_at)
     VALUES (?, 'Safira', 'Test', '2026-09-01', '2026-09-08', 'Doğrudan', 1000, 7000, ?, ?)`,
  ).bind(id, now, now).run();
}

async function insertPayment(opts: {
  reservationId: string;
  testMode: number;
  paymentType: string;
  status: string;
  requested: number;
  providerCustomerTotal: number | null;
  maxInstallment: number;
  noInstallment: number;
}) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO payments (id, reservation_id, provider, merchant_oid, payment_type, status, currency,
       reservation_total_minor, requested_amount_minor, provider_customer_total_minor, no_installment, max_installment, test_mode, created_at, updated_at)
     VALUES (?, ?, 'paytr', ?, ?, ?, 'TRY', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(), opts.reservationId, crypto.randomUUID(), opts.paymentType, opts.status,
    opts.requested, opts.requested, opts.providerCustomerTotal, opts.noInstallment, opts.maxInstallment, opts.testMode, now, now,
  ).run();
}

describe("getInstallmentCampaignReadiness (gercek SQLite entegrasyon testi)", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("hicbir gercek odeme yokken NOT_VERIFIED doner - kampanya asla kendiliginden ACTIVE olmaz", async () => {
    const { getInstallmentCampaignReadiness } = await import("./installment-campaign");
    const readiness = await getInstallmentCampaignReadiness();
    expect(readiness.state).toBe("INSTALLMENT_CAMPAIGN_NOT_VERIFIED");
  });

  it("yalniz test_mode odemeler varken (gercek yok) NOT_VERIFIED kalir", async () => {
    await seedReservation("res-1");
    await insertPayment({ reservationId: "res-1", testMode: 1, paymentType: "full_payment", status: "paid", requested: 700000, providerCustomerTotal: 700000, maxInstallment: 6, noInstallment: 0 });
    const { getInstallmentCampaignReadiness } = await import("./installment-campaign");
    const readiness = await getInstallmentCampaignReadiness();
    expect(readiness.state).toBe("INSTALLMENT_CAMPAIGN_NOT_VERIFIED");
    const evidenceItem = readiness.checklist.find((i) => i.label.includes("müşteri toplamı"));
    expect(evidenceItem?.status).toBe("NOT_VERIFIED");
  });

  it("gercek odemede musteri toplami ile istenen tutar UYUSMAZSA (vade farki) NOT_VERIFIED kalir, acikca belirtir", async () => {
    await seedReservation("res-2");
    await insertPayment({ reservationId: "res-2", testMode: 0, paymentType: "full_payment", status: "paid", requested: 700000, providerCustomerTotal: 715000, maxInstallment: 6, noInstallment: 0 });
    const { getInstallmentCampaignReadiness } = await import("./installment-campaign");
    const readiness = await getInstallmentCampaignReadiness();
    expect(readiness.state).toBe("INSTALLMENT_CAMPAIGN_NOT_VERIFIED");
    const evidenceItem = readiness.checklist.find((i) => i.label.includes("müşteri toplamı"));
    expect(evidenceItem?.note).toContain("EŞLEŞMEDİ");
  });

  it("gercek odemede musteri toplami tam eslessen bile - merchant panel maddeleri (MANUAL_ONLY) VERIFIED olmadan genel state hala NOT_VERIFIED", async () => {
    await seedReservation("res-3");
    await insertPayment({ reservationId: "res-3", testMode: 0, paymentType: "full_payment", status: "paid", requested: 700000, providerCustomerTotal: 700000, maxInstallment: 6, noInstallment: 0 });
    const { getInstallmentCampaignReadiness } = await import("./installment-campaign");
    const readiness = await getInstallmentCampaignReadiness();
    // INSTALLMENT_CAMPAIGN_MERCHANT_VERIFIED sabiti false oldugu surece asla VERIFIED olamaz
    expect(readiness.state).toBe("INSTALLMENT_CAMPAIGN_NOT_VERIFIED");
    const evidenceItem = readiness.checklist.find((i) => i.label.includes("müşteri toplamı"));
    expect(evidenceItem?.status).toBe("VERIFIED");
  });

  it("deposit tipi odemeler (full_payment olmayan) kanit olarak sayilmaz", async () => {
    await seedReservation("res-4");
    await insertPayment({ reservationId: "res-4", testMode: 0, paymentType: "deposit", status: "paid", requested: 140000, providerCustomerTotal: 140000, maxInstallment: 0, noInstallment: 1 });
    const { getInstallmentCampaignReadiness } = await import("./installment-campaign");
    const readiness = await getInstallmentCampaignReadiness();
    const evidenceItem = readiness.checklist.find((i) => i.label.includes("müşteri toplamı"));
    expect(evidenceItem?.note).toContain("kanıt bekleniyor");
  });

  it("maxInstallment her zaman FULL_PAYMENT_MAX_INSTALLMENT (6) sabitini yansitir", async () => {
    const { getInstallmentCampaignReadiness } = await import("./installment-campaign");
    const readiness = await getInstallmentCampaignReadiness();
    expect(readiness.maxInstallment).toBe(6);
  });
});
