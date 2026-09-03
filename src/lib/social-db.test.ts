// Faz 5 son denetim düzeltmesi (bölüm 6/7) - seedSocialPosts'un yeni autoApproveNewRows
// davranışını gerçek SQLite semantiğiyle doğrular: YALNIZ gerçekten yeni satırlar etkilenir,
// admin formu/varsayılan davranış (bayrak verilmemiş) ve MEVCUT satır güncellemeleri asla
// yanlışlıkla auto-approve edilmez.
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

const BASE_INPUT = { villa: "Safira" as const, platform: "Instagram" as const, contentType: "Gönderi" as const, scheduledDate: "2026-09-10", caption: "Test caption", mediaUrl: "/api/media/drive/x", mediaUrls: ["/api/media/drive/x"] };

describe("seedSocialPosts (autoApproveNewRows güvenlik davranışı)", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("bayrak verilmezse (admin formu / ensureDefaultSocialPlan davranışı) yeni satır 'İnsan onayı' ile eklenir - varsayılan DEĞİŞMEDİ", async () => {
    const { seedSocialPosts } = await import("./social-db");
    await seedSocialPosts([BASE_INPUT]);
    const row = await db.prepare("SELECT approval_status FROM social_posts WHERE caption = ?").bind(BASE_INPUT.caption).first<{ approval_status: string }>();
    expect(row?.approval_status).toBe("İnsan onayı");
  });

  it("autoApproveNewRows:true ile GERÇEKTEN yeni satır 'Onaylandı' ile eklenir", async () => {
    const { seedSocialPosts } = await import("./social-db");
    await seedSocialPosts([BASE_INPUT], { autoApproveNewRows: true });
    const row = await db.prepare("SELECT approval_status, approved_at FROM social_posts WHERE caption = ?").bind(BASE_INPUT.caption).first<{ approval_status: string; approved_at: string | null }>();
    expect(row?.approval_status).toBe("Onaylandı");
    expect(row?.approved_at).not.toBeNull();
  });

  it("MEVCUT bir satırın medyası değişse bile autoApproveNewRows:true ile YENİDEN auto-approve edilmez - hep 'İnsan onayı'na döner", async () => {
    const { seedSocialPosts } = await import("./social-db");
    // İlk ekleme - normal (insan onayı bekleyen) bir satır olarak.
    await seedSocialPosts([BASE_INPUT]);
    const before = await db.prepare("SELECT id, approval_status FROM social_posts WHERE caption = ?").bind(BASE_INPUT.caption).first<{ id: string; approval_status: string }>();
    expect(before?.approval_status).toBe("İnsan onayı");

    // Admin panelden elle onaylandığını simüle et.
    await db.prepare("UPDATE social_posts SET approval_status = 'Onaylandı', approved_at = ? WHERE id = ?").bind(new Date().toISOString(), before!.id).run();

    // Planlayıcı AYNI kimlikte ama FARKLI medya ile tekrar çağrılırsa (autoApproveNewRows:true
    // dahi geçse) - bu bir GÜNCELLEME'dir (yeni satır değil), her zaman 'İnsan onayı'na döner.
    await seedSocialPosts([{ ...BASE_INPUT, mediaUrl: "/api/media/drive/y" }], { autoApproveNewRows: true });
    const after = await db.prepare("SELECT id, approval_status, media_url FROM social_posts WHERE caption = ?").bind(BASE_INPUT.caption).first<{ id: string; approval_status: string; media_url: string }>();
    expect(after?.id).toBe(before?.id); // aynı satır, kopyalanmadı
    expect(after?.media_url).toBe("/api/media/drive/y");
    expect(after?.approval_status).toBe("İnsan onayı"); // yeniden onay bekliyor - yanlışlıkla auto-approve edilmedi
  });
});
