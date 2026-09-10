// Bu test dosyasi calisma zamanini (Cloudflare Workers/D1) taklit etmez - src/app/api/meta/instagram/
// publish/route.ts ve custom-worker.mjs, getCloudflareContext/D1 bağımlılığı yuzunden duz Node/vitest
// altinda calistirilamiyor. Bunun yerine kritik yayın korumalarının kaynak kodunda mevcut olduğunu
// doğrulayan regresyon/karakterizasyon testleri kullanılır.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url)); // .../src/lib
const ROOT = resolve(HERE, "..", ".."); // .../  (proje koku)

describe("Destan Instagram legacy backlog güvenlik regresyonu", () => {
  it("cron yalnız 2026-09-05 ve önceki Destan Instagram backlog'unu dışlıyor", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("NOT (villa = 'Destan' AND platform = 'Instagram' AND scheduled_date <= '2026-09-05')");
  });

  it("manuel/admin publish route eski Destan backlog'unu Graph çağrısından önce reddediyor", () => {
    const source = readFileSync(
      resolve(ROOT, "src", "app", "api", "meta", "instagram", "publish", "route.ts"),
      "utf-8",
    );
    expect(source).toContain('post.villa === "Destan" && post.scheduledDate <= "2026-09-05"');
    const guardIndex = source.indexOf('post.villa === "Destan"');
    const nextPublishCallIndex = source.indexOf("publishInstagram", guardIndex);
    expect(guardIndex).toBeGreaterThan(-1);
    expect(nextPublishCallIndex).toBeGreaterThan(guardIndex);
  });

  it("Destan Instagram publish route Facebook<->Instagram relationship gate'i kullanmıyor", () => {
    const source = readFileSync(
      resolve(ROOT, "src", "app", "api", "meta", "instagram", "publish", "route.ts"),
      "utf-8",
    );
    expect(source).not.toContain("checkFacebookInstagramRelationshipForVilla");
    expect(source).not.toContain("metaPublishGate(");
    expect(source).toContain("getInstagramCredentials(post.villa)");
    expect(source).toContain("getInstagramPublishingLimit(account.accountId, account.accessToken)");
  });
});

describe("Sosyal otomatik yayin MAX_ATTEMPTS regresyonu", () => {
  it("MAX_ATTEMPTS = 3 sabiti degismemis (custom-worker.mjs)", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("const MAX_ATTEMPTS = 3;");
  });

  it("duePosts sorgusu publish_attempt_count < MAX_ATTEMPTS filtresini iceriyor", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("COALESCE(publish_attempt_count, 0) < ?");
    expect(source).toContain(".bind(MAX_ATTEMPTS,");
  });

  it("custom-worker.mjs (cron gate) ve social-db.ts (dead-letter) MAX_ATTEMPTS icin AYNI degeri tasir", () => {
    const cronSource = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    const dbSource = readFileSync(resolve(ROOT, "src", "lib", "social-db.ts"), "utf-8");
    const cronMatch = cronSource.match(/const MAX_ATTEMPTS = (\d+);/);
    const dbMatch = dbSource.match(/const MAX_PUBLISH_ATTEMPTS = (\d+);/);
    expect(cronMatch).not.toBeNull();
    expect(dbMatch).not.toBeNull();
    expect(dbMatch![1]).toBe(cronMatch![1]);
  });
});

describe("Cron izolasyonu regresyonu", () => {
  it("runSocialCron her postu KENDI try/catch bloğunda işler - bir hata digerlerini durdurmaz", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    const fnStart = source.indexOf("async function runSocialCron");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, source.indexOf("\n}", fnStart));
    expect(fnBody).toContain("for (const post of posts) {");
    const forIndex = fnBody.indexOf("for (const post of posts) {");
    const tryIndex = fnBody.indexOf("try {", forIndex);
    const catchIndex = fnBody.indexOf("} catch (error) {", tryIndex);
    expect(tryIndex).toBeGreaterThan(forIndex);
    expect(catchIndex).toBeGreaterThan(tryIndex);
    const catchBody = fnBody.slice(catchIndex, fnBody.indexOf("}", fnBody.indexOf("errorCount += 1;", catchIndex)) + 1);
    expect(catchBody).not.toContain("break");
    expect(catchBody).not.toContain("return");
  });
});

describe("Exponential backoff regresyonu", () => {
  it("duePosts artan bekleme (1. hata sonrasi 30dk, 2. hata sonrasi 60dk) uyguluyor", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("const RETRY_BACKOFF_MINUTES = [30, 60];");
    expect(source).toContain("COALESCE(publish_attempt_count, 0) <= 1 AND last_publish_attempt_at <= ?");
    expect(source).toContain("COALESCE(publish_attempt_count, 0) = 2 AND last_publish_attempt_at <= ?");
  });
});

describe("DESTAN_IG doğrudan Instagram Login yayını regresyonu", () => {
  it("worker global Destan Instagram hard-block'unu kapatır; yalnız legacy backlog filtresi kalır", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("const DESTAN_INSTAGRAM_HARD_BLOCKED = false;");
    expect(source).not.toContain("const DESTAN_INSTAGRAM_HARD_BLOCKED = true;");
    expect(source).toContain("NOT (villa = 'Destan' AND platform = 'Instagram' AND scheduled_date <= '2026-09-05')");
  });

  it("worker ve sosyal hesap politikası aynı hard-block değerini taşır", () => {
    const cronSource = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    const policySource = readFileSync(resolve(ROOT, "src", "lib", "social-account-policy.ts"), "utf-8");
    const cronMatch = cronSource.match(/const DESTAN_INSTAGRAM_HARD_BLOCKED = (true|false);/);
    const policyMatch = policySource.match(/blocked: (true|false) as boolean,/);
    expect(cronMatch).not.toBeNull();
    expect(policyMatch).not.toBeNull();
    expect(cronMatch![1]).toBe(policyMatch![1]);
    expect(cronMatch![1]).toBe("false");
  });
});
