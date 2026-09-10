// Scheduler aday seçimini gerçek SQLite semantiğiyle kanıtlar. Destan Instagram artık doğrudan
// Instagram Login API ile aktif bir hedef; yalnız 2026-09-05 ve öncesi legacy backlog güvenlik
// nedeniyle aday listesinden çıkarılır. Yeni Destan Instagram kayıtları diğer Meta hedefleriyle
// aynı SOCIAL_AUTO_PUBLISH_LIMIT havuzunda adil şekilde yarışır.
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

// custom-worker.mjs commonFilter/dateClause davranışının kritik kısmı: yalnız legacy Destan IG
// backlog'u dışlanır; 2026-09-06 ve sonrası Destan Instagram normal adaydır.
const DUE_POSTS_SQL = `SELECT id, villa, platform FROM social_posts
  WHERE status = 'Planlandı'
    AND approval_status = 'Onaylandı'
    AND platform IN ('Instagram', 'Facebook')
    AND NOT (villa = 'Destan' AND platform = 'Instagram' AND scheduled_date <= '2026-09-05')
    AND scheduled_date <= ?
  ORDER BY id ASC
  LIMIT ?`;

async function seedPost(id: string, villa: string, platform: string, scheduledDate: string) {
  await db.prepare(
    `INSERT INTO social_posts (id, villa, platform, content_type, scheduled_date, caption, status, approval_status, created_at, updated_at)
     VALUES (?, ?, ?, 'Gönderi', ?, 'test caption', 'Planlandı', 'Onaylandı', ?, ?)`,
  ).bind(id, villa, platform, scheduledDate, new Date().toISOString(), new Date().toISOString()).run();
}

describe("Scheduler adilliği - Destan Instagram doğrudan yayın hedefi", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
  });

  it("2026-09-06 ve sonrası Destan Instagram normal aday olarak seçilir", async () => {
    await seedPost("1", "Destan", "Instagram", "2026-09-08");
    await seedPost("2", "Safira", "Instagram", "2026-09-08");
    await seedPost("3", "Destan", "Facebook", "2026-09-08");

    const result = await db.prepare(DUE_POSTS_SQL).bind("2026-09-08", 2).all<{ id: string; villa: string; platform: string }>();
    expect(result.results.map((r) => r.id)).toEqual(["1", "2"]);
    expect(result.results.some((r) => r.villa === "Destan" && r.platform === "Instagram")).toBe(true);
  });

  it("2026-09-05 ve öncesi Destan Instagram legacy backlog'u seçilmez", async () => {
    await seedPost("1", "Destan", "Instagram", "2026-09-05");
    await seedPost("2", "Destan", "Facebook", "2026-09-05");
    const result = await db.prepare(DUE_POSTS_SQL).bind("2026-09-10", 2).all<{ id: string }>();
    expect(result.results.map((r) => r.id)).toEqual(["2"]);
  });

  it("yeni Destan Instagram tek aday olduğunda boş sonuç dönmez", async () => {
    await seedPost("1", "Destan", "Instagram", "2026-09-10");
    const result = await db.prepare(DUE_POSTS_SQL).bind("2026-09-10", 2).all<{ id: string }>();
    expect(result.results.map((r) => r.id)).toEqual(["1"]);
  });

  it("Destan Facebook normal şekilde seçilir", async () => {
    await seedPost("1", "Destan", "Facebook", "2026-09-08");
    const result = await db.prepare(DUE_POSTS_SQL).bind("2026-09-08", 2).all<{ id: string }>();
    expect(result.results.map((r) => r.id)).toEqual(["1"]);
  });

  it("Safira Instagram normal şekilde seçilir", async () => {
    await seedPost("1", "Safira", "Instagram", "2026-09-08");
    const result = await db.prepare(DUE_POSTS_SQL).bind("2026-09-08", 2).all<{ id: string }>();
    expect(result.results.map((r) => r.id)).toEqual(["1"]);
  });
});
