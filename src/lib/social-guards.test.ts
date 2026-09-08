// Bu test dosyasi calisma zamanini (Cloudflare Workers/D1) taklit etmez - src/app/api/meta/instagram/
// publish/route.ts ve custom-worker.mjs, getCloudflareContext/D1 bağımlılığı yuzunden duz Node/vitest
// altinda calistirilamiyor. Bunun yerine, hicbir zaman kaldirilmamasi gereken iki HARD GUARD'in kaynak
// kodunda hala mevcut oldugunu dogrulayan bir regresyon/karakterizasyon testi: guard yanlislikla
// silinir/zayiflatilirsa bu test kirilir. Gercek yayin davranisini degil, guard'in VARLIGINI test eder.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url)); // .../src/lib
const ROOT = resolve(HERE, "..", ".."); // .../  (proje koku)

describe("Destan Instagram güvenli aktivasyon regresyonu", () => {
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
    // Guard, herhangi bir Graph API/medya cagrisindan ONCE calismali - import satirlarini degil,
    // guard'dan SONRAKI ilk gercek publishInstagram* CAGRISINI ariyoruz (fonksiyon govdesinde).
    const guardIndex = source.indexOf('post.villa === "Destan"');
    const nextPublishCallIndex = source.indexOf("publishInstagram", guardIndex);
    expect(guardIndex).toBeGreaterThan(-1);
    expect(nextPublishCallIndex).toBeGreaterThan(guardIndex);
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

describe("Cron izolasyonu regresyonu (bölüm 9/18 test 7 - bir hedefin hatası digerlerini durdurmaz)", () => {
  it("runSocialCron her postu KENDI try/catch bloğunda işler - bir hata dongu disina cikip digerlerini iptal etmez", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    const fnStart = source.indexOf("async function runSocialCron");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, source.indexOf("\n}", fnStart));
    expect(fnBody).toContain("for (const post of posts) {");
    // try, for'un ICINDE (her post icin ayri) olmali - for'un disinda TEK bir try/catch DEGIL.
    const forIndex = fnBody.indexOf("for (const post of posts) {");
    const tryIndex = fnBody.indexOf("try {", forIndex);
    const catchIndex = fnBody.indexOf("} catch (error) {", tryIndex);
    expect(tryIndex).toBeGreaterThan(forIndex);
    expect(catchIndex).toBeGreaterThan(tryIndex);
    // catch bloğu döngüyü kirmiyor (break/return yok) - hata sayilip bir sonraki post'a devam edilir.
    const catchBody = fnBody.slice(catchIndex, fnBody.indexOf("}", fnBody.indexOf("errorCount += 1;", catchIndex)) + 1);
    expect(catchBody).not.toContain("break");
    expect(catchBody).not.toContain("return");
  });
});

describe("Exponential backoff regresyonu (sabit 30dk cooldown yerine)", () => {
  it("duePosts artan bekleme (1. hata sonrasi 30dk, 2. hata sonrasi 60dk) uyguluyor", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("const RETRY_BACKOFF_MINUTES = [30, 60];");
    expect(source).toContain("COALESCE(publish_attempt_count, 0) <= 1 AND last_publish_attempt_at <= ?");
    expect(source).toContain("COALESCE(publish_attempt_count, 0) = 2 AND last_publish_attempt_at <= ?");
  });
});

describe("DESTAN_IG = BLOCKED_EXTERNAL_META_OWNERSHIP regresyonu (2026-09-08 dogrulanan Meta sahiplik sorunu)", () => {
  it("duePosts() Destan+Instagram'i (tarihten bagimsiz TUMU) WHERE cumlesinde eler - cron adaylik listesine hic girmez", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("const DESTAN_INSTAGRAM_HARD_BLOCKED = true;");
    expect(source).toContain("AND NOT (villa = 'Destan' AND platform = 'Instagram')");
  });

  it("custom-worker.mjs (DESTAN_INSTAGRAM_HARD_BLOCKED) ve social-account-policy.ts (DESTAN_INSTAGRAM_HARD_BLOCK.blocked) AYNI degeri tasir", () => {
    const cronSource = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    const policySource = readFileSync(resolve(ROOT, "src", "lib", "social-account-policy.ts"), "utf-8");
    const cronMatch = cronSource.match(/const DESTAN_INSTAGRAM_HARD_BLOCKED = (true|false);/);
    const policyMatch = policySource.match(/blocked: (true|false) as boolean,/);
    expect(cronMatch).not.toBeNull();
    expect(policyMatch).not.toBeNull();
    expect(cronMatch![1]).toBe(policyMatch![1]);
  });

  it("metaPublishGate icin BLOCKED_EXTERNAL_META_OWNERSHIP kodu kaynak kodda tanimli (eski BLOCKED_EXTERNAL_META_SETUP degil)", () => {
    const source = readFileSync(resolve(ROOT, "src", "lib", "social-account-policy.ts"), "utf-8");
    expect(source).toContain("BLOCKED_EXTERNAL_META_OWNERSHIP");
    expect(source).not.toContain("BLOCKED_EXTERNAL_META_SETUP");
  });
});
