import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "../test-utils/fake-d1";

let db: FakeD1;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db } }),
}));

const VALID_PHONE = "0541 242 44 55";

describe("syncCheckoutReminderForReservation", () => {
  beforeEach(() => {
    db = createFakeD1("");
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("geçerli telefon + gelecekteki çıkış tarihi için tam olarak checkout-1gün 11:00 Europe/Istanbul'a planlanmış bir SCHEDULED satır oluşturur", async () => {
    const { syncCheckoutReminderForReservation, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "r1", checkOut: "2099-09-20", phone: VALID_PHONE });
    const message = await getLatestCheckoutReminderForReservation("r1");
    expect(message?.status).toBe("SCHEDULED");
    expect(message?.checkoutDate).toBe("2099-09-20");
    expect(message?.scheduledAt).toBe("2099-09-19T08:00:00.000Z");
    expect(message?.recipientPhone).toBe("905412424455");
    expect(message?.autoEnabled).toBe(true);
  });

  it("geçersiz telefon için hiçbir satır oluşturmaz", async () => {
    const { syncCheckoutReminderForReservation, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "r2", checkOut: "2099-09-20", phone: "123" });
    expect(await getLatestCheckoutReminderForReservation("r2")).toBeNull();
  });

  it("boş telefon için hiçbir satır oluşturmaz", async () => {
    const { syncCheckoutReminderForReservation, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "r3", checkOut: "2099-09-20", phone: "" });
    expect(await getLatestCheckoutReminderForReservation("r3")).toBeNull();
  });

  it("çıkış tarihi geçmişte olan (artık aktif olmayan) bir rezervasyon için satır oluşturmaz", async () => {
    const { syncCheckoutReminderForReservation, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "r4", checkOut: "2020-01-01", phone: VALID_PHONE });
    expect(await getLatestCheckoutReminderForReservation("r4")).toBeNull();
  });

  it("aynı rezervasyon+çıkış tarihi için tekrar tekrar çağrılması (cron/webhook retry senaryosu) İKİNCİ bir satır OLUŞTURMAZ - DB seviyesinde tekillik", async () => {
    const { syncCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "r5", checkOut: "2099-09-20", phone: VALID_PHONE });
    await syncCheckoutReminderForReservation({ id: "r5", checkOut: "2099-09-20", phone: VALID_PHONE });
    await syncCheckoutReminderForReservation({ id: "r5", checkOut: "2099-09-20", phone: VALID_PHONE });
    const row = await db.prepare("SELECT COUNT(*) as cnt FROM whatsapp_scheduled_messages WHERE reservation_id = 'r5'").first<{ cnt: number }>();
    expect(row?.cnt).toBe(1);
  });

  it("çıkış tarihi değişirse: eski SCHEDULED satır CANCELLED olur, yeni tarih için yeni bir SCHEDULED satır açılır", async () => {
    const { syncCheckoutReminderForReservation, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "r6", checkOut: "2099-09-20", phone: VALID_PHONE });
    await syncCheckoutReminderForReservation({ id: "r6", checkOut: "2099-09-25", phone: VALID_PHONE });

    const all = await db.prepare("SELECT * FROM whatsapp_scheduled_messages WHERE reservation_id = 'r6' ORDER BY checkout_date").all<{ checkout_date: string; status: string }>();
    expect(all.results).toHaveLength(2);
    expect(all.results.find((r) => r.checkout_date === "2099-09-20")?.status).toBe("CANCELLED");
    expect(all.results.find((r) => r.checkout_date === "2099-09-25")?.status).toBe("SCHEDULED");

    const latest = await getLatestCheckoutReminderForReservation("r6");
    expect(latest?.checkoutDate).toBe("2099-09-25");
    expect(latest?.status).toBe("SCHEDULED");
  });

  it("telefon değişirse: aynı çıkış tarihindeki SCHEDULED satırın recipient_phone'u güncellenen/doğrulanmış numarayı kullanır", async () => {
    const { syncCheckoutReminderForReservation, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "r7", checkOut: "2099-09-20", phone: "0541 242 44 55" });
    await syncCheckoutReminderForReservation({ id: "r7", checkOut: "2099-09-20", phone: "0532 111 22 33" });
    const message = await getLatestCheckoutReminderForReservation("r7");
    expect(message?.recipientPhone).toBe("905321112233");
  });

  it("zaten SENT olan bir hatırlatma, aynı checkout_date için tekrar senkronize edilse (ör. telefon düzenlendi) OTOMATİK OLARAK TEKRAR GÖNDERİLMEK ÜZERE geri alınmaz", async () => {
    const { syncCheckoutReminderForReservation, claimCheckoutReminderForSending, markCheckoutReminderSent, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "r8", checkOut: "2099-09-20", phone: VALID_PHONE });
    const before = await getLatestCheckoutReminderForReservation("r8");
    await claimCheckoutReminderForSending(before!.id);
    await markCheckoutReminderSent(before!.id, "wamid.XYZ", "checkout_reminder_tr");

    // Aynı checkout_date ile tekrar senkronizasyon (ör. admin telefon numarasını düzeltti)
    await syncCheckoutReminderForReservation({ id: "r8", checkOut: "2099-09-20", phone: "0532 999 88 77" });

    const after = await getLatestCheckoutReminderForReservation("r8");
    expect(after?.status).toBe("SENT");
    expect(after?.providerMessageId).toBe("wamid.XYZ");
    // Telefon SENT satırda korunur - senkronizasyon SENT bir satırı asla değiştirmez.
    expect(after?.recipientPhone).toBe("905412424455");
  });
});

describe("cancelCheckoutReminderForReservation", () => {
  beforeEach(() => { db = createFakeD1(""); });
  afterEach(() => { db.close(); vi.resetModules(); });

  it("rezervasyon iptal/silindiğinde bekleyen (SCHEDULED) hatırlatmayı CANCELLED yapar", async () => {
    const { syncCheckoutReminderForReservation, cancelCheckoutReminderForReservation, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "c1", checkOut: "2099-09-20", phone: VALID_PHONE });
    await cancelCheckoutReminderForReservation("c1");
    const message = await getLatestCheckoutReminderForReservation("c1");
    expect(message?.status).toBe("CANCELLED");
  });

  it("zaten SENT olan bir hatırlatmayı CANCELLED yapmaz (yalnız SCHEDULED etkilenir)", async () => {
    const { syncCheckoutReminderForReservation, claimCheckoutReminderForSending, markCheckoutReminderSent, cancelCheckoutReminderForReservation, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "c2", checkOut: "2099-09-20", phone: VALID_PHONE });
    const message = await getLatestCheckoutReminderForReservation("c2");
    await claimCheckoutReminderForSending(message!.id);
    await markCheckoutReminderSent(message!.id, "wamid.ABC", "checkout_reminder_tr");

    await cancelCheckoutReminderForReservation("c2");
    const after = await getLatestCheckoutReminderForReservation("c2");
    expect(after?.status).toBe("SENT");
  });
});

describe("claimCheckoutReminderForSending (retry-safety / idempotency)", () => {
  beforeEach(() => { db = createFakeD1(""); });
  afterEach(() => { db.close(); vi.resetModules(); });

  it("ilk claim true döner, ikinci (eşzamanlı/tekrarlı cron) claim aynı id için false döner", async () => {
    const { syncCheckoutReminderForReservation, claimCheckoutReminderForSending, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "cl1", checkOut: "2099-09-20", phone: VALID_PHONE });
    const message = await getLatestCheckoutReminderForReservation("cl1");

    const firstClaim = await claimCheckoutReminderForSending(message!.id);
    const secondClaim = await claimCheckoutReminderForSending(message!.id);

    expect(firstClaim).toBe(true);
    expect(secondClaim).toBe(false);
  });
});

describe("markCheckoutReminderSent / markCheckoutReminderFailed", () => {
  beforeEach(() => { db = createFakeD1(""); });
  afterEach(() => { db.close(); vi.resetModules(); });

  it("başarılı Meta API çağrısı sonrası SENT + provider_message_id kaydeder", async () => {
    const { syncCheckoutReminderForReservation, claimCheckoutReminderForSending, markCheckoutReminderSent, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "m1", checkOut: "2099-09-20", phone: VALID_PHONE });
    const message = await getLatestCheckoutReminderForReservation("m1");
    await claimCheckoutReminderForSending(message!.id);
    await markCheckoutReminderSent(message!.id, "wamid.SUCCESS", "checkout_reminder_tr");

    const after = await getLatestCheckoutReminderForReservation("m1");
    expect(after?.status).toBe("SENT");
    expect(after?.providerMessageId).toBe("wamid.SUCCESS");
    expect(after?.sentAt).not.toBeNull();
  });

  it("başarısız Meta API çağrısı SENT olarak İŞARETLEMEZ - FAILED + failure_reason kaydeder", async () => {
    const { syncCheckoutReminderForReservation, claimCheckoutReminderForSending, markCheckoutReminderFailed, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "m2", checkOut: "2099-09-20", phone: VALID_PHONE });
    const message = await getLatestCheckoutReminderForReservation("m2");
    await claimCheckoutReminderForSending(message!.id);
    await markCheckoutReminderFailed(message!.id, "Meta API HTTP 400: Invalid parameter", "checkout_reminder_tr");

    const after = await getLatestCheckoutReminderForReservation("m2");
    expect(after?.status).toBe("FAILED");
    expect(after?.providerMessageId).toBeNull();
    expect(after?.failureReason).toContain("Invalid parameter");
  });

  it("claim edilmeden (SENDING olmadan) markCheckoutReminderSent çağrılırsa hiçbir şey değişmez (durum korumalı)", async () => {
    const { syncCheckoutReminderForReservation, markCheckoutReminderSent, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "m3", checkOut: "2099-09-20", phone: VALID_PHONE });
    const before = await getLatestCheckoutReminderForReservation("m3");
    await markCheckoutReminderSent(before!.id, "wamid.SHOULD_NOT_APPLY", "checkout_reminder_tr");
    const after = await getLatestCheckoutReminderForReservation("m3");
    expect(after?.status).toBe("SCHEDULED");
  });
});

describe("markCheckoutReminderSkippedNotConfigured", () => {
  beforeEach(() => { db = createFakeD1(""); });
  afterEach(() => { db.close(); vi.resetModules(); });

  it("yapılandırma yokken satırı SKIPPED_NOT_CONFIGURED yapar - SENT/FAILED değil", async () => {
    const { syncCheckoutReminderForReservation, claimCheckoutReminderForSending, markCheckoutReminderSkippedNotConfigured, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "s1", checkOut: "2099-09-20", phone: VALID_PHONE });
    const message = await getLatestCheckoutReminderForReservation("s1");
    await claimCheckoutReminderForSending(message!.id);
    await markCheckoutReminderSkippedNotConfigured(message!.id);

    const after = await getLatestCheckoutReminderForReservation("s1");
    expect(after?.status).toBe("SKIPPED_NOT_CONFIGURED");
  });
});

describe("listDueCheckoutReminders", () => {
  beforeEach(() => { db = createFakeD1(""); });
  afterEach(() => { db.close(); vi.resetModules(); });

  it("yalnız scheduled_at <= şimdi olan SCHEDULED satırları döner - gelecekteki bir hatırlatma dahil edilmez", async () => {
    const { syncCheckoutReminderForReservation, listDueCheckoutReminders } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "d1", checkOut: "2099-09-20", phone: VALID_PHONE }); // scheduled_at 2099-09-19
    const due = await listDueCheckoutReminders(new Date().toISOString(), 25);
    expect(due.find((m) => m.reservationId === "d1")).toBeUndefined();
  });

  it("scheduled_at geçmişte olan SCHEDULED bir satırı 'due' olarak döner", async () => {
    const { syncCheckoutReminderForReservation, listDueCheckoutReminders } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "d2", checkOut: "2099-09-20", phone: VALID_PHONE });
    // scheduled_at (2099-09-19T08:00Z) sonrası bir "şimdi" ile sorgula.
    const due = await listDueCheckoutReminders("2099-09-19T09:00:00.000Z", 25);
    expect(due.find((m) => m.reservationId === "d2")).toBeDefined();
  });

  it("auto_enabled=0 olan bir satırı asla döndürmez (admin devre dışı bırakmışsa cron atlamalı)", async () => {
    const { syncCheckoutReminderForReservation, setCheckoutReminderAutoEnabled, listDueCheckoutReminders } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "d3", checkOut: "2099-09-20", phone: VALID_PHONE });
    await setCheckoutReminderAutoEnabled("d3", false);
    const due = await listDueCheckoutReminders("2099-09-19T09:00:00.000Z", 25);
    expect(due.find((m) => m.reservationId === "d3")).toBeUndefined();
  });
});

describe("setCheckoutReminderAutoEnabled / retryFailedCheckoutReminder", () => {
  beforeEach(() => { db = createFakeD1(""); });
  afterEach(() => { db.close(); vi.resetModules(); });

  it("SCHEDULED bir satırı devre dışı bırakıp tekrar etkinleştirebilir", async () => {
    const { syncCheckoutReminderForReservation, setCheckoutReminderAutoEnabled, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "t1", checkOut: "2099-09-20", phone: VALID_PHONE });
    const disabled = await setCheckoutReminderAutoEnabled("t1", false);
    expect(disabled?.autoEnabled).toBe(false);
    const enabled = await setCheckoutReminderAutoEnabled("t1", true);
    expect(enabled?.autoEnabled).toBe(true);
    expect((await getLatestCheckoutReminderForReservation("t1"))?.autoEnabled).toBe(true);
  });

  it("SCHEDULED satırı olmayan bir rezervasyon için toggle null döner (no-op)", async () => {
    const { setCheckoutReminderAutoEnabled } = await import("./store");
    expect(await setCheckoutReminderAutoEnabled("nonexistent", false)).toBeNull();
  });

  it("yalnız GERÇEKTEN FAILED durumundaki bir kaydı yeniden dener - SCHEDULED'a döner, scheduled_at güncellenir", async () => {
    const { syncCheckoutReminderForReservation, claimCheckoutReminderForSending, markCheckoutReminderFailed, retryFailedCheckoutReminder, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "t2", checkOut: "2099-09-20", phone: VALID_PHONE });
    const before = await getLatestCheckoutReminderForReservation("t2");
    await claimCheckoutReminderForSending(before!.id);
    await markCheckoutReminderFailed(before!.id, "geçici hata", "checkout_reminder_tr");

    const retried = await retryFailedCheckoutReminder("t2");
    expect(retried?.status).toBe("SCHEDULED");
    expect(retried?.failureReason).toBeNull();
  });

  it("SENT/SCHEDULED gibi FAILED OLMAYAN bir kayıt için retry no-op'tur (null döner, durum değişmez)", async () => {
    const { syncCheckoutReminderForReservation, retryFailedCheckoutReminder, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "t3", checkOut: "2099-09-20", phone: VALID_PHONE });
    expect(await retryFailedCheckoutReminder("t3")).toBeNull();
    expect((await getLatestCheckoutReminderForReservation("t3"))?.status).toBe("SCHEDULED");
  });
});

describe("webhook durum güncellemeleri (provider_message_id ile eşleştirme)", () => {
  beforeEach(() => { db = createFakeD1(""); });
  afterEach(() => { db.close(); vi.resetModules(); });

  async function seedSentMessage(reservationId: string, providerMessageId: string) {
    const { syncCheckoutReminderForReservation, claimCheckoutReminderForSending, markCheckoutReminderSent, getLatestCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: reservationId, checkOut: "2099-09-20", phone: VALID_PHONE });
    const message = await getLatestCheckoutReminderForReservation(reservationId);
    await claimCheckoutReminderForSending(message!.id);
    await markCheckoutReminderSent(message!.id, providerMessageId, "checkout_reminder_tr");
  }

  it("delivered webhook'u SENT satırı DELIVERED yapar", async () => {
    await seedSentMessage("w1", "wamid.W1");
    const { markCheckoutReminderDeliveredByProviderMessageId, getLatestCheckoutReminderForReservation } = await import("./store");
    await markCheckoutReminderDeliveredByProviderMessageId("wamid.W1", "2099-09-19T09:00:00.000Z");
    const message = await getLatestCheckoutReminderForReservation("w1");
    expect(message?.status).toBe("DELIVERED");
    expect(message?.deliveredAt).toBe("2099-09-19T09:00:00.000Z");
  });

  it("read webhook'u DELIVERED satırı READ yapar", async () => {
    await seedSentMessage("w2", "wamid.W2");
    const { markCheckoutReminderDeliveredByProviderMessageId, markCheckoutReminderReadByProviderMessageId, getLatestCheckoutReminderForReservation } = await import("./store");
    await markCheckoutReminderDeliveredByProviderMessageId("wamid.W2", "2099-09-19T09:00:00.000Z");
    await markCheckoutReminderReadByProviderMessageId("wamid.W2", "2099-09-19T09:05:00.000Z");
    const message = await getLatestCheckoutReminderForReservation("w2");
    expect(message?.status).toBe("READ");
  });

  it("failed webhook'u SENT bir satırı FAILED yapar ve nedeni kaydeder", async () => {
    await seedSentMessage("w3", "wamid.W3");
    const { markCheckoutReminderFailedByProviderMessageId, getLatestCheckoutReminderForReservation } = await import("./store");
    await markCheckoutReminderFailedByProviderMessageId("wamid.W3", "recipient not on WhatsApp", "2099-09-19T09:10:00.000Z");
    const message = await getLatestCheckoutReminderForReservation("w3");
    expect(message?.status).toBe("FAILED");
    expect(message?.failureReason).toBe("recipient not on WhatsApp");
  });

  it("bilinmeyen bir provider_message_id için hiçbir satırı etkilemez (sessizce yok sayar)", async () => {
    await seedSentMessage("w4", "wamid.W4");
    const { markCheckoutReminderDeliveredByProviderMessageId, getLatestCheckoutReminderForReservation } = await import("./store");
    await markCheckoutReminderDeliveredByProviderMessageId("wamid.UNKNOWN", "2099-09-19T09:00:00.000Z");
    const message = await getLatestCheckoutReminderForReservation("w4");
    expect(message?.status).toBe("SENT");
  });
});

describe("manuel (wa.me) ve otomatik gönderim durum ayrımı", () => {
  beforeEach(() => { db = createFakeD1(""); });
  afterEach(() => { db.close(); vi.resetModules(); });

  it("otomatik hatırlatma tablosu, mevcut manuel wa.me akışının kullandığı reservations.phone alanına hiç yazmaz - ayrı bir tablo/durumdur", async () => {
    const { syncCheckoutReminderForReservation } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "sep1", checkOut: "2099-09-20", phone: VALID_PHONE });
    const reservationTableExists = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reservations'").first();
    expect(reservationTableExists).toBeNull(); // bu test DB'sinde reservations tablosu hiç yok - whatsapp store'un ona dokunmadığının kanıtı.
  });
});

describe("listLatestCheckoutRemindersForReservations", () => {
  beforeEach(() => { db = createFakeD1(""); });
  afterEach(() => { db.close(); vi.resetModules(); });

  it("birden fazla rezervasyon için her birinin EN GÜNCEL kaydını döner", async () => {
    const { syncCheckoutReminderForReservation, listLatestCheckoutRemindersForReservations } = await import("./store");
    await syncCheckoutReminderForReservation({ id: "l1", checkOut: "2099-09-20", phone: VALID_PHONE });
    await syncCheckoutReminderForReservation({ id: "l2", checkOut: "2099-09-25", phone: VALID_PHONE });

    const map = await listLatestCheckoutRemindersForReservations(["l1", "l2", "l3-not-found"]);
    expect(map.size).toBe(2);
    expect(map.get("l1")?.checkoutDate).toBe("2099-09-20");
    expect(map.get("l2")?.checkoutDate).toBe("2099-09-25");
    expect(map.has("l3-not-found")).toBe(false);
  });

  it("boş liste için boş bir Map döner (D1'e sorgu atmaz)", async () => {
    const { listLatestCheckoutRemindersForReservations } = await import("./store");
    const map = await listLatestCheckoutRemindersForReservations([]);
    expect(map.size).toBe(0);
  });
});
