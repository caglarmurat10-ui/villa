// Gercek SQLite (node:sqlite) uzerinde - payments/db.ts'in D1 CAS/idempotency/UNIQUE kisitlarini
// hic degistirmeden dogrular. Para ile ilgili kod oldugu icin (double-charge, race condition)
// bilerek gercek SQL semantigiyle test edildi - mock/fake obje davranisina guvenilmedi.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "../test-utils/fake-d1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");

function loadSchema(): string {
  const files = ["0001_schema.sql", "0012_payments.sql", "0013_payments_active_guard.sql"];
  return files.map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8")).join("\n");
}

let db: FakeD1;
let nextId = 0;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db } }),
}));

// generatePaymentId gercek crypto.randomUUID kullanir - testte carpisma senaryosunu (UNIQUE
// constraint) elle tetikleyebilmek icin ongorulebilir/sabit id'ler uretiyoruz.
vi.mock("./crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./crypto")>();
  return { ...actual, generatePaymentId: () => `payid-${++nextId}` };
});

async function seedReservation(id: string, totalAmount = 7000) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO reservations (id, villa, guest_name, check_in, check_out, channel, nightly_rate, total_amount, created_at, updated_at)
     VALUES (?, 'Safira', 'Test Misafir', '2026-09-01', '2026-09-08', 'Doğrudan', 1000, ?, ?, ?)`,
  ).bind(id, totalAmount, now, now).run();
}

describe("payments/db.ts (gercek SQLite entegrasyon testi)", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
    nextId = 0;
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("createPayment: merchant_oid carpismasinda (UNIQUE) null doner, throw etmez", async () => {
    const { createPayment } = await import("./db");
    await seedReservation("res-1");

    // ayni sabit id iki kez uretilecek sekilde nextId'yi geri sarariz
    nextId = 0;
    const first = await createPayment({
      reservationId: "res-1", paymentType: "deposit", reservationTotalMinor: 700000,
      requestedAmountMinor: 210000, noInstallment: true, maxInstallment: 0, testMode: true,
    });
    expect(first).not.toBeNull();

    nextId = 0; // ayni id'yi tekrar uret -> merchant_oid UNIQUE ihlali
    const second = await createPayment({
      reservationId: "res-1", paymentType: "deposit", reservationTotalMinor: 700000,
      requestedAmountMinor: 210000, noInstallment: true, maxInstallment: 0, testMode: true,
    });
    expect(second).toBeNull();
  });

  it("migration 0013: ayni rezervasyon icin ikinci GERCEK (test_mode=0) aktif deneme engellenir", async () => {
    const { createPayment } = await import("./db");
    await seedReservation("res-2");

    const first = await createPayment({
      reservationId: "res-2", paymentType: "full_payment", reservationTotalMinor: 700000,
      requestedAmountMinor: 700000, noInstallment: true, maxInstallment: 0, testMode: false,
    });
    expect(first).not.toBeNull();

    const second = await createPayment({
      reservationId: "res-2", paymentType: "full_payment", reservationTotalMinor: 700000,
      requestedAmountMinor: 700000, noInstallment: true, maxInstallment: 0, testMode: false,
    });
    expect(second).toBeNull(); // partial unique index (reservation_id) WHERE test_mode=0 AND status IN (created,pending)
  });

  it("test_mode=1 rezervasyonlar icin ayni kisit uygulanmaz (paralel test denemeleri serbest)", async () => {
    const { createPayment } = await import("./db");
    await seedReservation("res-3");

    const first = await createPayment({
      reservationId: "res-3", paymentType: "full_payment", reservationTotalMinor: 700000,
      requestedAmountMinor: 700000, noInstallment: true, maxInstallment: 0, testMode: true,
    });
    const second = await createPayment({
      reservationId: "res-3", paymentType: "full_payment", reservationTotalMinor: 700000,
      requestedAmountMinor: 700000, noInstallment: true, maxInstallment: 0, testMode: true,
    });
    expect(first).not.toBeNull();
    expect(second).not.toBeNull(); // test_mode=0 kisiti test_mode=1'i etkilemez
  });

  it("claimPaymentForCheckout: iki eszamanli claim'den yalnizca biri kazanir (CAS)", async () => {
    const { createPayment, claimPaymentForCheckout } = await import("./db");
    await seedReservation("res-4");
    const payment = await createPayment({
      reservationId: "res-4", paymentType: "deposit", reservationTotalMinor: 700000,
      requestedAmountMinor: 210000, noInstallment: true, maxInstallment: 0, testMode: true,
    });
    expect(payment).not.toBeNull();

    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const claim1 = await claimPaymentForCheckout(payment!.id, expires);
    const claim2 = await claimPaymentForCheckout(payment!.id, expires); // ayni payment, artik status='pending'
    expect(claim1).toBe(true);
    expect(claim2).toBe(false); // WHERE status='created' artik eslesmez
  });

  it("markPaymentPaidIfPending: cift callback idempotent - ikinci cagri false doner, paid_amount iki kez eklenmez", async () => {
    const { createPayment, claimPaymentForCheckout, markPaymentPaidIfPending, getPayment } = await import("./db");
    await seedReservation("res-5", 7000);
    const payment = await createPayment({
      reservationId: "res-5", paymentType: "full_payment", reservationTotalMinor: 700000,
      requestedAmountMinor: 700000, noInstallment: true, maxInstallment: 0, testMode: false,
    });
    await claimPaymentForCheckout(payment!.id, new Date(Date.now() + 1800000).toISOString());
    const claimed = (await getPayment(payment!.id))!;

    const first = await markPaymentPaidIfPending(claimed, 700000);
    const second = await markPaymentPaidIfPending(claimed, 700000); // PayTR'in ayni callback'i tekrar gonderdigi senaryo
    expect(first).toBe(true);
    expect(second).toBe(false);

    const reservation = await db.prepare("SELECT paid_amount FROM reservations WHERE id = 'res-5'").first<{ paid_amount: number }>();
    expect(reservation?.paid_amount).toBe(7000); // 700000 kurus / 100, YALNIZ BIR KEZ yazildi
  });

  it("markPaymentPaidIfPending: test_mode=true odemede reservations.paid_amount HIC guncellenmez", async () => {
    const { createPayment, claimPaymentForCheckout, markPaymentPaidIfPending, getPayment } = await import("./db");
    await seedReservation("res-6", 7000);
    const payment = await createPayment({
      reservationId: "res-6", paymentType: "full_payment", reservationTotalMinor: 700000,
      requestedAmountMinor: 700000, noInstallment: true, maxInstallment: 0, testMode: true,
    });
    await claimPaymentForCheckout(payment!.id, new Date(Date.now() + 1800000).toISOString());
    const claimed = (await getPayment(payment!.id))!;

    const won = await markPaymentPaidIfPending(claimed, 700000);
    expect(won).toBe(true);

    const reservation = await db.prepare("SELECT paid_amount FROM reservations WHERE id = 'res-6'").first<{ paid_amount: number }>();
    expect(reservation?.paid_amount).toBe(0); // test odemesi gercek finansi etkilemez
  });

  it("markPaymentFailedIfPending: zaten 'paid' olan bir odemeyi failed'a cekemez (CAS terminal koruma)", async () => {
    const { createPayment, claimPaymentForCheckout, markPaymentPaidIfPending, markPaymentFailedIfPending, getPayment } = await import("./db");
    await seedReservation("res-7");
    const payment = await createPayment({
      reservationId: "res-7", paymentType: "deposit", reservationTotalMinor: 700000,
      requestedAmountMinor: 210000, noInstallment: true, maxInstallment: 0, testMode: true,
    });
    await claimPaymentForCheckout(payment!.id, new Date(Date.now() + 1800000).toISOString());
    const claimed = (await getPayment(payment!.id))!;
    await markPaymentPaidIfPending(claimed, 210000);

    const failed = await markPaymentFailedIfPending(payment!.id, "gec gelen basarisiz callback");
    expect(failed).toBe(false); // status artik 'paid', WHERE status='pending' eslesmiyor

    const final = await getPayment(payment!.id);
    expect(final?.status).toBe("paid"); // race'i callback degil, ilk 'paid' kazandi
  });

  it("computeReservationPaymentSummary: yalniz gercek+paid odemeler toplama dahil olur", async () => {
    const { createPayment, claimPaymentForCheckout, markPaymentPaidIfPending, getPayment, computeReservationPaymentSummary } = await import("./db");
    await seedReservation("res-8", 10000);

    const realPayment = await createPayment({
      reservationId: "res-8", paymentType: "deposit", reservationTotalMinor: 1000000,
      requestedAmountMinor: 300000, noInstallment: true, maxInstallment: 0, testMode: false,
    });
    await claimPaymentForCheckout(realPayment!.id, new Date(Date.now() + 1800000).toISOString());
    await markPaymentPaidIfPending((await getPayment(realPayment!.id))!, 300000);

    const testPayment = await createPayment({
      reservationId: "res-8", paymentType: "deposit", reservationTotalMinor: 1000000,
      requestedAmountMinor: 500000, noInstallment: true, maxInstallment: 0, testMode: true,
    });
    await claimPaymentForCheckout(testPayment!.id, new Date(Date.now() + 1800000).toISOString());
    await markPaymentPaidIfPending((await getPayment(testPayment!.id))!, 500000);

    const summary = await computeReservationPaymentSummary("res-8");
    expect(summary.paidTotalMinor).toBe(300000); // yalnız gerçek ödeme (3000 TL), test ödemesi (5000 TL) hariç
    expect(summary.remainingTotalMinor).toBe(700000);
  });
});
