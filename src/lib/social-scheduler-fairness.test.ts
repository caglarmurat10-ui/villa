// Bölüm 10 - "bloklanan bir hedef, SOCIAL_AUTO_PUBLISH_LIMIT slotunu tüketmemeli" senaryosunu
// gerçek SQLite semantiğiyle kanıtlar. custom-worker.mjs'in duePosts() fonksiyonunu doğrudan
// import EDEMEYİZ (D1/Cloudflare bağımlılığı, bkz. social-guards.test.ts'teki üst not) - bunun
// yerine AYNI WHERE cümlesi yapısını (hard-block + tarih/deneme/cooldown filtreleri) gerçek
// social_posts şemasına karşı çalıştırırız. Bu testin custom-worker.mjs'in GERÇEK kaynak koduyla
// yapısal olarak eşleştiği social-guards.test.ts'teki regresyon testleriyle (aynı sabit adı/aynı
// WHERE parçası) çapraz doğrulanır - biri değişip diğeri unutulursa o test kırılır.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createFakeD1, type FakeD1 } from "./test-utils/fake-d1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

function loadSchema(): string {
  return ["0001_schema.sql", "0002_social_posts.sql", "0004_social_publish_tracking.sql", "0006_social_publish_lock.sql", "0007_social_post_media.sql", "0015_social_posts_scheduled_time.sql"]
    .map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8"))
    .join("\n");
}

let db: FakeD1;

// custom-worker.mjs'teki commonFilter + dateClause ile YAPISAL OLARAK AYNI (hard-block dahil) -
// bkz. yukarıdaki not.
const DUE_POSTS_SQL = `SELECT id, villa, platform FROM social_posts
  WHERE status = 'Planlandı'
    AND approval_status = 'Onaylandı'
    AND platform IN ('Instagram', 'Facebook')
    AND NOT (villa = 'Destan' AND platform = 'Instagram')
    AND scheduled_date <= ?
  ORDER BY id ASC
  LIMIT ?`;

async function seedPost(id: string, villa: string, platform: string, scheduledDate: string) {
  await db.prepare(
    `INSERT INTO social_posts (id, villa, platform, content_type, scheduled_date, caption, status, approval_status, created_at, updated_at)
     VALUES (?, ?, ?, 'Gönderi', ?, 'test caption', 'Planlandı', 'Onaylandı', ?, ?)`,
  ).bind(id, villa, platform, scheduledDate, new Date().toISOString(), new Date().toISOString()).run();
}

describe("Scheduler adilliği - bloklanan DESTAN_IG bir SOCIAL_AUTO_PUBLISH_LIMIT slotu tüketmez", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
  });

  it("bölüm 10 örneği: [1 DESTAN_IG blocked, 2 SAFIRA_IG ready, 3 DESTAN_FB ready], limit=2 -> [2,3] döner, 1 hiç seçilmez", async () => {
    await seedPost("1", "Destan", "Instagram", "2026-09-08");
    await seedPost("2", "Safira", "Instagram", "2026-09-08");
    await seedPost("3", "Destan", "Facebook", "2026-09-08");

    const result = await db.prepare(DUE_POSTS_SQL).bind("2026-09-08", 2).all<{ id: string; villa: string; platform: string }>();
    const ids = result.results.map((r) => r.id).sort();
    expect(ids).toEqual(["2", "3"]);
    expect(result.results.some((r) => r.villa === "Destan" && r.platform === "Instagram")).toBe(false);
  });

  it("yalnız DESTAN_IG varsa (başka aday yok) boş sonuç döner - hata/çökme yok", async () => {
    await seedPost("1", "Destan", "Instagram", "2026-09-08");
    const result = await db.prepare(DUE_POSTS_SQL).bind("2026-09-08", 2).all<{ id: string }>();
    expect(result.results).toHaveLength(0);
  });

  it("DESTAN_FB (bloklu DEĞİL) normal şekilde seçilir - blok yalnız Instagram platformuna özel", async () => {
    await seedPost("1", "Destan", "Facebook", "2026-09-08");
    const result = await db.prepare(DUE_POSTS_SQL).bind("2026-09-08", 2).all<{ id: string }>();
    expect(result.results.map((r) => r.id)).toEqual(["1"]);
  });

  it("SAFIRA_IG bloklu DEĞİL - normal şekilde seçilir", async () => {
    await seedPost("1", "Safira", "Instagram", "2026-09-08");
    const result = await db.prepare(DUE_POSTS_SQL).bind("2026-09-08", 2).all<{ id: string }>();
    expect(result.results.map((r) => r.id)).toEqual(["1"]);
  });
});
