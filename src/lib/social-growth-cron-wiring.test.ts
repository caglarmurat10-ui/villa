// custom-worker.mjs, getCloudflareContext/D1 bağımlılığı yüzünden düz Node/vitest altında
// çalıştırılamıyor (bkz. social-guards.test.ts aynı desen) - bu yüzden Public Web Scout cron
// kablolamasını kaynak metni üzerinde bir regresyon/karakterizasyon testiyle doğruluyoruz.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

describe("Social Growth Agent - Public Web Scout cron kablolaması", () => {
  it("wrangler.jsonc yeni '0 5 * * *' cron'unu içeriyor, mevcut üç cron'a dokunmadan", () => {
    const source = readFileSync(resolve(ROOT, "wrangler.jsonc"), "utf-8");
    expect(source).toContain('"*/15 * * * *"');
    expect(source).toContain('"*/30 * * * *"');
    expect(source).toContain('"0 3 * * *"');
    expect(source).toContain('"0 5 * * *"');
  });

  it("SOCIAL_SCOUT_SEARCH_API_KEY wrangler.jsonc secrets.required listesine EKLENMEMİŞ (deploy'u bloklamamalı)", () => {
    const source = readFileSync(resolve(ROOT, "wrangler.jsonc"), "utf-8");
    const requiredBlockMatch = source.match(/"required":\s*\[[\s\S]*?\]/);
    expect(requiredBlockMatch?.[0] ?? "").not.toContain("SOCIAL_SCOUT_SEARCH_API_KEY");
  });

  it("custom-worker.mjs '0 5 * * *' için runPublicScoutIfDue'yu çağırıyor ve runSocialCron fallback'inden ÖNCE return ediyor", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("async function runPublicScoutIfDue(env, ctx)");
    expect(source).toContain('controller.cron === "0 5 * * *"');

    const branchIndex = source.indexOf('controller.cron === "0 5 * * *"');
    const fallbackIndex = source.indexOf("await runSocialCron(controller, env, ctx);");
    expect(branchIndex).toBeGreaterThan(-1);
    expect(fallbackIndex).toBeGreaterThan(-1);
    expect(branchIndex).toBeLessThan(fallbackIndex);
  });

  it("runPublicScoutIfDue diğer cronlarla aynı KV-korumalı 'günde bir kez' desenini kullanıyor", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain('const PUBLIC_SCOUT_KV_KEY = "social_public_scout_last_run_date";');
    expect(source).toContain("env.META_PRIVATE.get(PUBLIC_SCOUT_KV_KEY)");
    expect(source).toContain("env.META_PRIVATE.put(PUBLIC_SCOUT_KV_KEY, today)");
  });

  it("runPublicScoutIfDue in-process çağrıda zorunlu Host header'ı ayarlıyor (2026-08-30 kök neden deseni)", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    const fnStart = source.indexOf("async function runPublicScoutIfDue(env, ctx)");
    const fnBody = source.slice(fnStart, fnStart + 1500);
    expect(fnBody).toContain("/api/social-growth/public-scout/run");
    expect(fnBody).toContain("Host: new URL(targetUrl).host");
  });
});
