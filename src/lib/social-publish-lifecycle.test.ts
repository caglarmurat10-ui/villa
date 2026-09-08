// markSocialPublishFailure'ın MAX_PUBLISH_ATTEMPTS'e ulaşınca dead-letter'a taşıma davranışını
// (bölüm 9/18: exponential backoff + dead-letter) gerçek SQLite semantiğiyle doğrular.
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
  return [
    "0001_schema.sql",
    "0002_social_posts.sql",
    "0004_social_publish_tracking.sql",
    "0006_social_publish_lock.sql",
    "0007_social_post_media.sql",
    "0015_social_posts_scheduled_time.sql",
    "0022_archive_quarantined_social_failures.sql",
  ]
    .map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8"))
    .join("\n");
}

const BASE_INPUT = {
  villa: "Safira" as const,
  platform: "Instagram" as const,
  contentType: "Gönderi" as const,
  scheduledDate: "2026-09-10",
  caption: "Dead-letter test caption",
  mediaUrl: "/api/media/drive/x",
  mediaUrls: ["/api/media/drive/x"],
};

async function seedApprovedPost() {
  const { seedSocialPosts } = await import("./social-db");
  await seedSocialPosts([BASE_INPUT], { autoApproveNewRows: true });
  const row = await db.prepare("SELECT id FROM social_posts WHERE caption = ?").bind(BASE_INPUT.caption).first<{ id: string }>();
  return row!.id;
}

describe("claimSocialPublishAttempt — duplicate publication prevention (bölüm 9/18 test 6)", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("aynı gönderi için ikinci bir claim, ilk kilit hâlâ geçerliyken reddedilir (null döner) - çift yayın engellenir", async () => {
    const { claimSocialPublishAttempt } = await import("./social-db");
    const id = await seedApprovedPost();

    const first = await claimSocialPublishAttempt(id);
    expect(first).not.toBeNull();

    // Cron ve manuel "Şimdi yayınla" aynı postu eşzamanlı seçse bile - ikinci çağrı kilidi alamaz.
    const second = await claimSocialPublishAttempt(id);
    expect(second).toBeNull();
  });

  it("başarıyla yayınlanan bir gönderi tekrar claim edilemez (status artık 'Planlandı' değil)", async () => {
    const { claimSocialPublishAttempt, markSocialPublishSuccess } = await import("./social-db");
    const id = await seedApprovedPost();
    const claim = await claimSocialPublishAttempt(id);
    await markSocialPublishSuccess(id, claim!.lockToken, "IG_MEDIA_123");

    const retry = await claimSocialPublishAttempt(id);
    expect(retry).toBeNull();
  });
});

describe("markSocialPublishFailure — dead-letter after MAX_PUBLISH_ATTEMPTS", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("1. ve 2. başarısızlıktan sonra satır hâlâ 'Onaylandı' kalır (cron tarafından tekrar denenebilir)", async () => {
    const { claimSocialPublishAttempt, markSocialPublishFailure } = await import("./social-db");
    const id = await seedApprovedPost();

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const claim = await claimSocialPublishAttempt(id);
      expect(claim).not.toBeNull();
      await markSocialPublishFailure(id, claim!.lockToken, `deneme ${attempt} hatası`);
      const row = await db.prepare("SELECT approval_status, publish_attempt_count FROM social_posts WHERE id = ?")
        .bind(id).first<{ approval_status: string; publish_attempt_count: number }>();
      expect(row?.approval_status).toBe("Onaylandı");
      expect(row?.publish_attempt_count).toBe(attempt);
    }
  });

  it("3. (son) başarısızlıktan sonra satır dead-letter'a taşınır: approval_status='İnsan onayı', approved_at=NULL", async () => {
    const { claimSocialPublishAttempt, markSocialPublishFailure } = await import("./social-db");
    const id = await seedApprovedPost();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const claim = await claimSocialPublishAttempt(id);
      expect(claim).not.toBeNull();
      await markSocialPublishFailure(id, claim!.lockToken, `deneme ${attempt} hatası`);
    }

    const row = await db.prepare("SELECT approval_status, approved_at, publish_attempt_count, last_publish_error FROM social_posts WHERE id = ?")
      .bind(id).first<{ approval_status: string; approved_at: string | null; publish_attempt_count: number; last_publish_error: string }>();
    expect(row?.approval_status).toBe("İnsan onayı");
    expect(row?.approved_at).toBeNull();
    expect(row?.publish_attempt_count).toBe(3);
    expect(row?.last_publish_error).toContain("deneme 3");
  });

  it("dead-letter satırı social_publish_failure_archive'a yapılandırılmış bir kayıt olarak yazılır", async () => {
    const { claimSocialPublishAttempt, markSocialPublishFailure } = await import("./social-db");
    const id = await seedApprovedPost();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const claim = await claimSocialPublishAttempt(id);
      await markSocialPublishFailure(id, claim!.lockToken, `deneme ${attempt} hatası`);
    }

    const archived = await db.prepare("SELECT * FROM social_publish_failure_archive WHERE post_id = ?").bind(id).first<Record<string, unknown>>();
    expect(archived).not.toBeNull();
    expect(archived?.villa).toBe("Safira");
    expect(archived?.platform).toBe("Instagram");
    expect(archived?.publish_attempt_count).toBe(3);
    expect(String(archived?.error_message)).toContain("deneme 3");
  });

  it("dead-letter'a taşınan satır artık cron'un 'Onaylandı'-only seçim filtresine uymaz (yeniden otomatik denenmez)", async () => {
    const { claimSocialPublishAttempt, markSocialPublishFailure } = await import("./social-db");
    const id = await seedApprovedPost();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const claim = await claimSocialPublishAttempt(id);
      await markSocialPublishFailure(id, claim!.lockToken, `deneme ${attempt} hatası`);
    }

    // custom-worker.mjs duePosts() ile aynı temel filtre: yalnız approval_status = 'Onaylandı'.
    const eligible = await db.prepare("SELECT id FROM social_posts WHERE id = ? AND approval_status = 'Onaylandı'").bind(id).first();
    expect(eligible).toBeNull();
  });
});
