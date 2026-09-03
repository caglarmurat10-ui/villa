// Gercek SQLite (node:sqlite) uzerinde calisan entegrasyon testleri - sync.ts'in D1 upsert/
// idempotency/conflict-detection mantigini, D1'e hic dokunmadan, ayni SQL semantigiyle dogrular.
// getCloudflareContext ve fetchIcsSafely (network+SSRF katmani) mock'lanir - sync.ts'in KENDISI
// degistirilmez, yalnizca disari acilan iki kapisi test icin sahtelenir.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "../test-utils/fake-d1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");

function loadSchema(): string {
  const files = ["0001_schema.sql", "0011_ota_calendar_sync.sql"];
  return files.map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8")).join("\n");
}

let db: FakeD1;
let icsResponses: Record<string, string> = {};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db, OTA_PRIVATE: { get: async () => "https://ical.booking.com/v1/export?s=test" } } }),
}));

// Not: getImportUrl (OTA_PRIVATE.get, yukarıda) villa'dan bağımsız SABİT bir URL döner - bu
// mock'un villa bilgisine erişimi yok. Her testte tek bir villa/platform kombinasyonu senkronize
// edildiği için (iki farklı villa'nın AYNI ANDA farklı ICS içerikle senkronize edildiği hiçbir
// test yok) anahtar yalnız platform'a göre - villa öneki KASITLI OLARAK yok, gereksiz bir
// ayrım değil (Villa Destan OTA kapatma turu, sync.integration.test.ts'e Destan testi eklenirken
// düzeltildi - eskiden "Safira:" sabit önekliydi, Destan testleri sessizce hiç fixture bulamazdı).
vi.mock("./security", () => ({
  fetchIcsSafely: async (_url: string, platform: string) => {
    if (!(platform in icsResponses)) throw new Error(`test: no fixture for ${platform}`);
    return icsResponses[platform];
  },
  sanitizeErrorMessage: (msg: string) => msg.slice(0, 500),
}));

function vevent(uid: string, start: string, end: string) {
  return `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nEND:VEVENT\r\n`;
}
function ics(...events: string[]) {
  return `BEGIN:VCALENDAR\r\n${events.join("")}END:VCALENDAR\r\n`;
}

async function seedConnection(villa: "Safira" | "Destan", platform: "airbnb" | "booking") {
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT INTO ota_connections (id, villa, platform, is_enabled, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
  ).bind(crypto.randomUUID(), villa, platform, now, now).run();
}

describe("syncOneConnection (gercek SQLite entegrasyon testi)", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
    icsResponses = {};
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("ayni UID'li ICS'i iki kez isleme almak idempotent - satir cogalmaz", async () => {
    await seedConnection("Safira", "booking");
    icsResponses["booking"] = ics(vevent("evt-1", "20260901", "20260908"));
    const { syncOneConnection } = await import("./sync");

    const first = await syncOneConnection("Safira", "booking");
    expect(first.ok).toBe(true);
    const afterFirst = await db.prepare("SELECT * FROM external_blocks").all<{ id: string; status: string }>();
    expect(afterFirst.results).toHaveLength(1);
    expect(afterFirst.results[0].status).toBe("active");

    const second = await syncOneConnection("Safira", "booking");
    expect(second.ok).toBe(true);
    const afterSecond = await db.prepare("SELECT * FROM external_blocks").all<{ id: string }>();
    expect(afterSecond.results).toHaveLength(1);
    expect(afterSecond.results[0].id).toBe(afterFirst.results[0].id); // ayni satir, yeni satir DEGIL
  });

  it("120 gunden uzun tek bir blok otomatik needs_review'e duser (anomali tespiti)", async () => {
    await seedConnection("Safira", "booking");
    // 2026-09-02 canlı olayindaki gibi ~1 yillik anormal blok
    icsResponses["booking"] = ics(vevent("evt-anomaly", "20260902", "20270902"));
    const { syncOneConnection } = await import("./sync");

    await syncOneConnection("Safira", "booking");
    const row = await db.prepare("SELECT status FROM external_blocks WHERE external_uid = 'evt-anomaly'").first<{ status: string }>();
    expect(row?.status).toBe("needs_review");

    const auditRow = await db.prepare("SELECT action FROM audit_log WHERE action = 'ANOMALOUS_BLOCK_DETECTED'").first();
    expect(auditRow).not.toBeNull();
  });

  it("gercek bir direkt rezervasyonla cakisan OTA blogu needs_review olur", async () => {
    await seedConnection("Safira", "booking");
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO reservations (id, villa, guest_name, check_in, check_out, channel, nightly_rate, total_amount, created_at, updated_at)
       VALUES (?, 'Safira', 'Test Misafir', '2026-09-01', '2026-09-08', 'Doğrudan', 1000, 7000, ?, ?)`,
    ).bind(crypto.randomUUID(), now, now).run();

    icsResponses["booking"] = ics(vevent("evt-conflict", "20260903", "20260906"));
    const { syncOneConnection } = await import("./sync");
    await syncOneConnection("Safira", "booking");

    const row = await db.prepare("SELECT status FROM external_blocks WHERE external_uid = 'evt-conflict'").first<{ status: string }>();
    expect(row?.status).toBe("needs_review");
  });

  it("feed'den kalkan (iptal edilen) blok status='removed' olur, hard-delete edilmez", async () => {
    await seedConnection("Safira", "booking");
    icsResponses["booking"] = ics(vevent("evt-cancel-me", "20260901", "20260905"));
    const { syncOneConnection } = await import("./sync");
    await syncOneConnection("Safira", "booking");

    icsResponses["booking"] = ics(); // feed artik bos - misafir iptal etti
    await syncOneConnection("Safira", "booking");

    const row = await db.prepare("SELECT status FROM external_blocks WHERE external_uid = 'evt-cancel-me'").first<{ status: string }>();
    expect(row?.status).toBe("removed"); // satir hala var, hard-delete edilmedi
  });

  // Villa Destan OTA kapatma turu, senaryo D - hasOtherSourceConflict (CROSS-OTA blok-blok
  // cakismasi) hicbir zaman ayri test edilmemisti, yalniz hasDirectReservationConflict (yukarida)
  // test edilmisti. Bu iki AYRI kod yolu (bkz. sync.ts) - biri direkt rezervasyona, digeri
  // BASKA bir OTA'nin mevcut bloguna karsi kontrol eder.
  it("Villa Destan - Booking'den gelen bir blok, ONCEDEN senkronlanmis AKTIF bir Airbnb blogu ile cakisirsa needs_review'e duser (cross-OTA cakisma, direkt rezervasyon DEGIL)", async () => {
    await seedConnection("Destan", "airbnb");
    await seedConnection("Destan", "booking");
    const now = new Date().toISOString();
    // Once Airbnb'den ONCEDEN senkronlanmis, AKTIF bir blok var (D1'e dogrudan ekleniyor - Airbnb
    // sync'i zaten daha once calismis gibi simule ediliyor).
    await db.prepare(
      `INSERT INTO external_blocks (id, villa, source, external_uid, start_date, end_date, status, last_synced_at, created_at, updated_at)
       VALUES (?, 'Destan', 'airbnb', 'evt-airbnb-existing', '2027-07-10', '2027-07-17', 'active', ?, ?, ?)`,
    ).bind(crypto.randomUUID(), now, now, now).run();

    icsResponses["booking"] = ics(vevent("evt-booking-overlap", "20270712", "20270715"));
    const { syncOneConnection } = await import("./sync");
    await syncOneConnection("Destan", "booking");

    const row = await db.prepare("SELECT status FROM external_blocks WHERE external_uid = 'evt-booking-overlap'").first<{ status: string }>();
    expect(row?.status).toBe("needs_review");
  });

  it("checkout gunu yeni check-in icin musait sayilir (start<end, end<=start ihlali yok)", async () => {
    await seedConnection("Safira", "booking");
    icsResponses["booking"] = ics(vevent("evt-checkout", "20260901", "20260908"));
    const { syncOneConnection } = await import("./sync");
    await syncOneConnection("Safira", "booking");

    const row = await db.prepare("SELECT start_date, end_date FROM external_blocks WHERE external_uid = 'evt-checkout'").first<{ start_date: string; end_date: string }>();
    // Ayni gunde baska bir rezervasyon check-in yapabilmeli: hasDirectReservationConflict/isBooked
    // mantigi start_date<=date<end_date kullanir, yani 2026-09-08 (checkout) bir sonraki
    // rezervasyonun check_in'i olabilir - burada yalnizca dogru tarihlerin D1'e yazildigini dogruluyoruz.
    expect(row).toEqual({ start_date: "2026-09-01", end_date: "2026-09-08" });
  });
});
