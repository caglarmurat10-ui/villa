// Manuel yayın iş akışı (bölüm 6/12/18 test 8, 12) - READY_FOR_MANUAL_PUBLISH/MANUALLY_PUBLISHED
// ASLA gerçek Meta Graph API yayınıyla (platform_post_id) karıştırılamaz.
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
  ]
    .map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8"))
    .join("\n");
  // 0026 kasıtlı olarak dahil EDİLMEDİ - social-db.ts'in prepareTable() self-heal'i (ALTER TABLE
  // ADD COLUMN) bu iki yeni sütunu zaten runtime'da ekliyor; bu test bilerek migration dosyası
  // OLMADAN da özelliğin çalıştığını (self-heal güvenilir olduğunu) kanıtlıyor.
}

const BASE_INPUT = {
  villa: "Destan" as const,
  platform: "Instagram" as const,
  contentType: "Gönderi" as const,
  scheduledDate: "2026-09-20",
  caption: "Manuel yayın test caption",
  mediaUrl: "/api/media/drive/x",
  mediaUrls: ["/api/media/drive/x"],
};

async function seedApprovedPost() {
  const { seedSocialPosts } = await import("./social-db");
  await seedSocialPosts([BASE_INPUT], { autoApproveNewRows: true });
  const row = await db.prepare("SELECT id FROM social_posts WHERE caption = ?").bind(BASE_INPUT.caption).first<{ id: string }>();
  return row!.id;
}

describe("markReadyForManualPublish / markManuallyPublished", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("ready aşaması: manual_publish_state='READY_FOR_MANUAL_PUBLISH' olur, status HÂLÂ 'Planlandı' kalır", async () => {
    const { markReadyForManualPublish } = await import("./social-db");
    const id = await seedApprovedPost();
    const post = await markReadyForManualPublish(id);
    expect(post?.manualPublishState).toBe("READY_FOR_MANUAL_PUBLISH");
    expect(post?.status).toBe("Planlandı");
    expect(post?.platformPostId).toBeNull();
  });

  it("confirm aşaması: manual_publish_state='MANUALLY_PUBLISHED', status='Yayınlandı' olur AMA platform_post_id HİÇBİR ZAMAN yazılmaz", async () => {
    const { markReadyForManualPublish, markManuallyPublished } = await import("./social-db");
    const id = await seedApprovedPost();
    await markReadyForManualPublish(id);
    const post = await markManuallyPublished(id);
    expect(post?.manualPublishState).toBe("MANUALLY_PUBLISHED");
    expect(post?.status).toBe("Yayınlandı");
    expect(post?.manuallyPublishedAt).not.toBeNull();
    // KRİTİK: gerçek Graph API yanıtı OLMADAN platform_post_id ASLA doldurulmaz - "sağlayıcı
    // yayınladı" gibi görünmesi YASAK.
    expect(post?.platformPostId).toBeNull();
  });

  it("manuel yayın geçmişi, GERÇEK Graph API yayınından (markSocialPublishSuccess) her zaman ayırt edilebilir", async () => {
    const { seedSocialPosts, claimSocialPublishAttempt, markSocialPublishSuccess } = await import("./social-db");
    // Gerçek API yayını simülasyonu (ayrı bir satır) - platform_post_id gerçekten dolu.
    await seedSocialPosts([{ ...BASE_INPUT, caption: "API published caption" }], { autoApproveNewRows: true });
    const apiRow = await db.prepare("SELECT id FROM social_posts WHERE caption = ?").bind("API published caption").first<{ id: string }>();
    const claim = await claimSocialPublishAttempt(apiRow!.id);
    const apiPost = await markSocialPublishSuccess(apiRow!.id, claim!.lockToken, "IG_REAL_MEDIA_ID_123");

    // Manuel yayın simülasyonu (başka bir satır).
    const manualId = await seedApprovedPost();
    const { markReadyForManualPublish, markManuallyPublished } = await import("./social-db");
    await markReadyForManualPublish(manualId);
    const manualPost = await markManuallyPublished(manualId);

    // İkisi de status='Yayınlandı' ama yalnız GERÇEK API yayını platform_post_id taşır.
    expect(apiPost?.status).toBe("Yayınlandı");
    expect(apiPost?.platformPostId).toBe("IG_REAL_MEDIA_ID_123");
    expect(apiPost?.manualPublishState).toBeNull();

    expect(manualPost?.status).toBe("Yayınlandı");
    expect(manualPost?.platformPostId).toBeNull();
    expect(manualPost?.manualPublishState).toBe("MANUALLY_PUBLISHED");
  });

  it("READY aşaması atlanıp doğrudan confirm çağrılırsa da veritabanı katmanında yine de doğru alanları set eder (asıl 'atlama yasağı' API route seviyesinde uygulanır - bkz. route testi)", async () => {
    const { markManuallyPublished } = await import("./social-db");
    const id = await seedApprovedPost();
    const post = await markManuallyPublished(id);
    expect(post?.manualPublishState).toBe("MANUALLY_PUBLISHED");
    expect(post?.platformPostId).toBeNull();
  });

  it("zaten yayınlanmış (status='Yayınlandı') bir satır manuel yayın fonksiyonlarıyla tekrar değiştirilemez", async () => {
    const { markReadyForManualPublish, markManuallyPublished, updateSocialPostStatus } = await import("./social-db");
    const id = await seedApprovedPost();
    await updateSocialPostStatus(id, "Yayınlandı");
    const readyResult = await markReadyForManualPublish(id);
    expect(readyResult?.manualPublishState).toBeNull();
    const confirmResult = await markManuallyPublished(id);
    expect(confirmResult?.manualPublishState).toBeNull();
  });
});
