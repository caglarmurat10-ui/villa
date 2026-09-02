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

describe("Destan Instagram HARD BLOCK regresyonu", () => {
  it("cron aday sorgusu villa=Destan + platform=Instagram'i disliyor (custom-worker.mjs)", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("NOT (villa = 'Destan' AND platform = 'Instagram')");
  });

  it("manuel/admin publish route'u Destan icin sert reddediyor (route.ts)", () => {
    const source = readFileSync(
      resolve(ROOT, "src", "app", "api", "meta", "instagram", "publish", "route.ts"),
      "utf-8",
    );
    expect(source).toContain('post.villa === "Destan"');
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
});
