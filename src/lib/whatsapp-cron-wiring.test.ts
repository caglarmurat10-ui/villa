// custom-worker.mjs, getCloudflareContext/D1 bağımlılığı yüzünden düz Node/vitest altında
// çalıştırılamıyor (bkz. gbp-cron-wiring.test.ts aynı desen) - bu yüzden WhatsApp checkout
// hatırlatma cron kablolamasını kaynak metni üzerinde bir regresyon/karakterizasyon testiyle
// doğruluyoruz.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");

describe("WhatsApp checkout hatırlatma cron kablolaması", () => {
  it("custom-worker.mjs runWhatsappCheckoutCron'u tanımlıyor ve */15 tikinde runSocialCron'dan SONRA çağırıyor (mevcut cron'a EKLENDİ, yeni bir tetikleyici eklenmedi)", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain("async function runWhatsappCheckoutCron(env, ctx)");
    const socialCallIndex = source.indexOf("await runSocialCron(controller, env, ctx);");
    const whatsappCallIndex = source.indexOf("await runWhatsappCheckoutCron(env, ctx);");
    expect(socialCallIndex).toBeGreaterThan(-1);
    expect(whatsappCallIndex).toBeGreaterThan(-1);
    expect(whatsappCallIndex).toBeGreaterThan(socialCallIndex);
  });

  it("runWhatsappCheckoutCron in-process çağrıda zorunlu Host header'ı ayarlıyor ve /api/admin/whatsapp/dispatch-due'yu hedefliyor", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    const fnStart = source.indexOf("async function runWhatsappCheckoutCron(env, ctx)");
    const fnBody = source.slice(fnStart, fnStart + 1200);
    expect(fnBody).toContain("/api/admin/whatsapp/dispatch-due");
    expect(fnBody).toContain("Host: new URL(targetUrl).host");
  });

  it("runWhatsappBackfillIfDue diğer günlük cron'larla (social planner/scout/GBP) aynı KV-korumalı 'bugün zaten çalıştı mı' desenini kullanıyor ve '0 3 * * *' tikine bağlı", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    expect(source).toContain('const WHATSAPP_BACKFILL_KV_KEY = "whatsapp_checkout_backfill_last_run_date";');
    expect(source).toContain("env.META_PRIVATE.get(WHATSAPP_BACKFILL_KV_KEY)");
    expect(source).toContain("env.META_PRIVATE.put(WHATSAPP_BACKFILL_KV_KEY, today)");
    expect(source).toContain("await runWhatsappBackfillIfDue(env, ctx);");

    const tickIndex = source.indexOf('controller.cron === "0 3 * * *"');
    const backfillCallIndex = source.indexOf("await runWhatsappBackfillIfDue(env, ctx);");
    const nextTickIndex = source.indexOf('controller.cron === "0 5 * * *"');
    expect(tickIndex).toBeGreaterThan(-1);
    expect(backfillCallIndex).toBeGreaterThan(tickIndex);
    expect(backfillCallIndex).toBeLessThan(nextTickIndex);
  });

  it("ADMIN_PUBLIC_PATHS Meta'nın webhook'unu (/api/webhooks/whatsapp) admin oturum duvarından muaf tutuyor", () => {
    const source = readFileSync(resolve(ROOT, "custom-worker.mjs"), "utf-8");
    const setStart = source.indexOf("const ADMIN_PUBLIC_PATHS = new Set([");
    const setEnd = source.indexOf("]);", setStart);
    const setBody = source.slice(setStart, setEnd);
    expect(setBody).toContain('"/api/webhooks/whatsapp"');
  });

  it("wrangler.jsonc WhatsApp secret'larını 'secrets.required' listesine EKLEMİYOR (fail-closed, deploy'u engellemez)", () => {
    const source = readFileSync(resolve(ROOT, "wrangler.jsonc"), "utf-8");
    const requiredStart = source.indexOf('"required": [');
    const requiredEnd = source.indexOf("]", requiredStart);
    const requiredBlock = source.slice(requiredStart, requiredEnd);
    expect(requiredBlock).not.toContain("WHATSAPP_ACCESS_TOKEN");
    expect(requiredBlock).not.toContain("WHATSAPP_PHONE_NUMBER_ID");
  });
});
