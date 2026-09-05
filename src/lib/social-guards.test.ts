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
});
