import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "./test-utils/fake-d1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

let db: FakeD1;

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { DB: db } }),
}));

function loadSchema(): string {
  return ["0001_schema.sql", "0002_social_posts.sql", "0004_social_publish_tracking.sql", "0006_social_publish_lock.sql", "0007_social_post_media.sql", "0015_social_posts_scheduled_time.sql"]
    .map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8"))
    .join("\n");
}

async function insertPost(overrides: Partial<{
  id: string; villa: string; platform: string; scheduled_date: string; status: string;
  last_publish_error: string | null; last_publish_attempt_at: string | null; publish_attempt_count: number | null; published_at: string | null;
}>) {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(), villa: "Safira", platform: "Instagram", content_type: "Gönderi",
    scheduled_date: "2026-09-02", caption: "test", media_url: "/x.jpg", status: "Planlandı",
    approval_status: "Onaylandı", approved_at: now, published_at: null,
    last_publish_error: null, last_publish_attempt_at: null, publish_attempt_count: 0,
    created_at: now, updated_at: now,
    ...overrides,
  };
  await db.prepare(`INSERT INTO social_posts
    (id, villa, platform, content_type, scheduled_date, caption, media_url, status, approval_status, approved_at, published_at, last_publish_error, last_publish_attempt_at, publish_attempt_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(row.id, row.villa, row.platform, row.content_type, row.scheduled_date, row.caption, row.media_url, row.status, row.approval_status, row.approved_at, row.published_at, row.last_publish_error, row.last_publish_attempt_at, row.publish_attempt_count, row.created_at, row.updated_at)
    .run();
}

describe("getPublishStats - Faz 6.1 bölüm 8: aktif hata ile denemeleri tükenmiş (legacy) hata ayrımı", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("publish_attempt_count < 3 olan hatalı satır 'failed' (AKTİF) sayılır, 'legacyFailed' sayılmaz", async () => {
    await insertPost({ last_publish_error: "HTTP 500", last_publish_attempt_at: "2026-09-02T10:00:00.000Z", publish_attempt_count: 1 });
    const { getPublishStats } = await import("./social-library-summary");
    const stats = await getPublishStats(7, "2026-09-03");
    expect(stats.failedCount).toBe(1);
    expect(stats.legacyFailedCount).toBe(0);
  });

  it("publish_attempt_count >= 3 (retries exhausted) olan satir 'legacyFailed' sayilir, 'failed' (AKTİF) sayilmaz - Faz 6.1'deki gercek 2026-09-02 Safira IG 400/9007 satirinin tam senaryosu", async () => {
    await insertPost({ last_publish_error: "Instagram yayını başarısız (HTTP 400 / 9007)", last_publish_attempt_at: "2026-09-02T10:00:00.000Z", publish_attempt_count: 3 });
    const { getPublishStats } = await import("./social-library-summary");
    const stats = await getPublishStats(7, "2026-09-03");
    expect(stats.failedCount).toBe(0);
    expect(stats.legacyFailedCount).toBe(1);
  });

  it("legacyFailedCount pencere (windowDays) disindaki eski tarihlerde bile HER ZAMAN sayilir - bu satir cron tarafindan bir daha asla secilmeyecegi icin 'ne zaman oldugu' onemli degil, yalniz durumu onemli", async () => {
    await insertPost({ last_publish_error: "eski hata", last_publish_attempt_at: "2020-01-01T00:00:00.000Z", publish_attempt_count: 5 });
    const { getPublishStats } = await import("./social-library-summary");
    const stats = await getPublishStats(7, "2026-09-03");
    expect(stats.legacyFailedCount).toBe(1);
  });

  it("basariyla yayinlanan satirlar publishedCount'a girer, iki hata sayacini etkilemez", async () => {
    await insertPost({ status: "Yayınlandı", published_at: "2026-09-02T10:00:00.000Z", last_publish_error: null });
    const { getPublishStats } = await import("./social-library-summary");
    const stats = await getPublishStats(7, "2026-09-03");
    expect(stats.publishedCount).toBe(1);
    expect(stats.failedCount).toBe(0);
    expect(stats.legacyFailedCount).toBe(0);
  });
});
