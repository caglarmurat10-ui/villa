// custom-worker.mjs, getCloudflareContext/D1 bağımlılığı yüzünden düz Node/vitest altında
// çalıştırılamıyor (bkz. social-growth-cron-wiring.test.ts aynı desen) - bu yüzden GBP otomatik
// gönderi cron kablolamasını kaynak metni üzerinde bir regresyon/karakterizasyon testiyle
// doğruluyoruz.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

describe("GBP otomatik gönderi cron kablolaması", () => {
  it("wrangler.jsonc yeni '0 7 * * 1,4' cron'unu içeriyor, mevcut beş cron'a dokunmadan", () => {
    const source = readFileSync(resolve(ROOT, "wrangler.jsonc"), "utf-8");
    expect(source).toContain('"*/15 * * * *"');
    expect(source).toContain('"*/30 * * * *"');
    expect(source).toContain('"0 3 * * *"');
    expect(source).toContain('"0 5 * * *"');
    expect(source).toContain('"0 7 * * 1,4"');
  });

  it("custom-worker.mjs '0 7 * * 1,4' için runGbpPostCronIfDue'yu çağırıyor ve runSocialCron fallback'inden ÖNCE return ediyor", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("async function runGbpPostCronIfDue(env, ctx)");
    expect(source).toContain('controller.cron === "0 7 * * 1,4"');

    const branchIndex = source.indexOf('controller.cron === "0 7 * * 1,4"');
    const fallbackIndex = source.indexOf("await runSocialCron(controller, env, ctx);");
    expect(branchIndex).toBeGreaterThan(-1);
    expect(fallbackIndex).toBeGreaterThan(-1);
    expect(branchIndex).toBeLessThan(fallbackIndex);
  });

  it("runGbpPostCronIfDue diğer cron'larla aynı KV-korumalı 'bugün zaten çalıştı mı' desenini kullanıyor", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain('const GBP_POST_CRON_KV_KEY = "gbp_post_cron_last_run_date";');
    expect(source).toContain("env.META_PRIVATE.get(GBP_POST_CRON_KV_KEY)");
    expect(source).toContain("env.META_PRIVATE.put(GBP_POST_CRON_KV_KEY, today)");
  });

  it("runGbpPostCronIfDue in-process çağrıda zorunlu Host header'ı ayarlıyor (2026-08-30 kök neden deseni)", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    const fnStart = source.indexOf("async function runGbpPostCronIfDue(env, ctx)");
    const fnBody = source.slice(fnStart, fnStart + 1500);
    expect(fnBody).toContain("/api/admin/google/gbp/auto-publish");
    expect(fnBody).toContain("Host: new URL(targetUrl).host");
  });
});
