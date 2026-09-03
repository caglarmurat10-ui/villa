// Faz 4 bolum U - HARD RULE: web sitesinde gorunen rezervasyon toplami = musterinin odeyecegi
// nihai tutar. PayTR/saglayici maliyeti/komisyonu musteriye ASLA eklenmez. Bu test dosyasi, bu
// degismezligi ACIKCA, isimle test eder - db.integration.test.ts'teki dolayli kanittan ayri olarak,
// gelecekte biri bu davranisi yanlislikla bozarsa burada KIRILSIN diye.
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

async function seedReservation(id: string, totalAmount: number) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO reservations (id, villa, guest_name, check_in, check_out, channel, nightly_rate, total_amount, created_at, updated_at)
     VALUES (?, 'Safira', 'Test', '2026-09-01', '2026-09-08', 'Doğrudan', 1000, ?, ?, ?)`,
  ).bind(id, totalAmount, now, now).run();
}

describe("customer price invariant (Faz 4 bölüm U — HARD RULE)", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("createPayment: requested_amount_minor cagirana verilen degerin AYNISI - hicbir sunucu-tarafi ek/markup yok", async () => {
    const { createPayment } = await import("./db");
    await seedReservation("res-1", 7000); // 7000 TL = 700000 kurus
    const payment = await createPayment({
      reservationId: "res-1", paymentType: "full_payment", reservationTotalMinor: 700000,
      requestedAmountMinor: 700000, noInstallment: false, maxInstallment: 6, testMode: true,
    });
    expect(payment).not.toBeNull();
    expect(payment!.requestedAmountMinor).toBe(700000); // reservation_total ile BIREBIR ayni
    expect(payment!.reservationTotalMinor).toBe(payment!.requestedAmountMinor); // provider maliyeti icin ekstra kalem yok
  });

  it("PayTR'ın bildirdiği providerCustomerTotalMinor (vade farkı olsa bile) reservations.paid_amount hesabını ETKİLEMEZ", async () => {
    const { createPayment, claimPaymentForCheckout, markPaymentPaidIfPending, getPayment, computeReservationPaymentSummary } = await import("./db");
    await seedReservation("res-2", 7000);
    const payment = await createPayment({
      reservationId: "res-2", paymentType: "full_payment", reservationTotalMinor: 700000,
      requestedAmountMinor: 700000, noInstallment: false, maxInstallment: 6, testMode: false,
    });
    await claimPaymentForCheckout(payment!.id, new Date(Date.now() + 1800000).toISOString());
    const claimed = (await getPayment(payment!.id))!;

    // PayTR taksit/vade farkiyla GERCEKTE 715000 kurus tahsil ettigini bildiriyor (requested'tan yuksek)
    const providerReportedTotal = 715000;
    await markPaymentPaidIfPending(claimed, providerReportedTotal);

    const summary = await computeReservationPaymentSummary("res-2");
    // Muhasebe HER ZAMAN requested_amount_minor'dan hesaplanir (700000), provider'in bildirdigi
    // 715000'den DEGIL - musteri fiyati asla saglayici maliyeti/vade farkiyla ARTMAZ.
    expect(summary.paidTotalMinor).toBe(700000);
    expect(summary.paidTotalMinor).not.toBe(providerReportedTotal);

    const reservationRow = await db.prepare("SELECT paid_amount FROM reservations WHERE id = 'res-2'").first<{ paid_amount: number }>();
    expect(reservationRow?.paid_amount).toBe(7000); // TL cinsinden - reservation.total_amount ile ayni, artmadi
  });

  it("provider_customer_total_minor alanı D1'e kaydedilir (finans kaydı için) ama requested_amount_minor'ı DEĞİŞTİRMEZ", async () => {
    const { createPayment, claimPaymentForCheckout, markPaymentPaidIfPending, getPayment } = await import("./db");
    await seedReservation("res-3", 7000);
    const payment = await createPayment({
      reservationId: "res-3", paymentType: "full_payment", reservationTotalMinor: 700000,
      requestedAmountMinor: 700000, noInstallment: false, maxInstallment: 6, testMode: false,
    });
    await claimPaymentForCheckout(payment!.id, new Date(Date.now() + 1800000).toISOString());
    await markPaymentPaidIfPending((await getPayment(payment!.id))!, 715000);

    const final = await getPayment(payment!.id);
    expect(final?.providerCustomerTotalMinor).toBe(715000); // finans kaydı için saklandı
    expect(final?.requestedAmountMinor).toBe(700000); // musteriden istenen tutar HİÇ değişmedi
  });

  it("deposit tipinde de ayni degismezlik gecerli - tek cekim, ek ucret yok", async () => {
    const { createPayment } = await import("./db");
    await seedReservation("res-4", 10000);
    const depositAmount = Math.round(10000 * 100 * 0.2); // %20 on odeme, kurus
    const payment = await createPayment({
      reservationId: "res-4", paymentType: "deposit", reservationTotalMinor: 1000000,
      requestedAmountMinor: depositAmount, noInstallment: true, maxInstallment: 0, testMode: true,
    });
    expect(payment!.requestedAmountMinor).toBe(depositAmount);
    expect(payment!.noInstallment).toBe(true); // deposit her zaman tek cekim
  });
});
