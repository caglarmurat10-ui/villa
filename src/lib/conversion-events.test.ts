import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "./test-utils/fake-d1";

let db: FakeD1;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db } }),
}));

describe("conversion-events (D1 dönüşüm günlüğü)", () => {
  beforeEach(() => {
    db = createFakeD1(""); // tablo runtime'da self-heal ile oluşturulur (prepareTable)
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("bir event kaydeder ve toplamlarda görünür", async () => {
    const { recordConversionEvent, getConversionEventTotals } = await import("./conversion-events");
    await recordConversionEvent({ eventName: "whatsapp_click", villa: "Safira", utmSource: "instagram" });
    const since = new Date(Date.now() - 60_000).toISOString();
    const totals = await getConversionEventTotals(since);
    expect(totals.whatsapp_click).toBe(1);
    expect(totals.page_view).toBe(0);
  });

  it("UTM kaynağına göre özetlenebilir", async () => {
    const { recordConversionEvent, getConversionEventSummary } = await import("./conversion-events");
    await recordConversionEvent({ eventName: "instagram_click", villa: "Destan", utmSource: "instagram", utmMedium: "bio_link" });
    await recordConversionEvent({ eventName: "instagram_click", villa: "Destan", utmSource: "instagram", utmMedium: "bio_link" });
    await recordConversionEvent({ eventName: "whatsapp_click", villa: "Destan", utmSource: "facebook" });
    const since = new Date(Date.now() - 60_000).toISOString();
    const summary = await getConversionEventSummary(since);
    const instagramRow = summary.find((row) => row.eventName === "instagram_click" && row.utmSource === "instagram");
    expect(instagramRow?.count).toBe(2);
  });

  it("PII içermez - yalnız izin verilen sütunlar yazılır (adres/isim/telefon gibi bir alan tabloda yok)", async () => {
    const { recordConversionEvent } = await import("./conversion-events");
    await recordConversionEvent({ eventName: "page_view", landingPath: "/villa-safira" });
    const row = await db.prepare("SELECT * FROM conversion_events LIMIT 1").first<Record<string, unknown>>();
    const columns = Object.keys(row ?? {});
    expect(columns).toEqual([
      "id", "event_name", "villa", "utm_source", "utm_medium", "utm_campaign", "utm_content", "landing_path", "referrer_host", "created_at",
    ]);
  });

  it("uzun/kötüye kullanım amaçlı UTM değerleri kırpılır (D1'e sınırsız string yazılmaz)", async () => {
    const { recordConversionEvent } = await import("./conversion-events");
    await recordConversionEvent({ eventName: "page_view", utmSource: "x".repeat(500) });
    const row = await db.prepare("SELECT utm_source FROM conversion_events LIMIT 1").first<{ utm_source: string }>();
    expect(row!.utm_source.length).toBeLessThanOrEqual(120);
  });
});
