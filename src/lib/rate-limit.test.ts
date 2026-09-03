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

describe("rate-limit (gercek SQLite entegrasyon testi)", () => {
  beforeEach(() => {
    db = createFakeD1(readFileSync(resolve(ROOT, "migrations", "0001_schema.sql"), "utf-8"));
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("esik altinda limitlenmez, esige ulasinca limitlenir", async () => {
    const { isRateLimited, recordRateLimitHit } = await import("./rate-limit");
    const ip = "1.2.3.4";
    for (let i = 0; i < 7; i += 1) {
      expect(await isRateLimited(ip, "TEST_SCOPE", 15 * 60 * 1000, 8)).toBe(false);
      await recordRateLimitHit(ip, "TEST_SCOPE");
    }
    // 7 kayit var, esik 8 - hala limitlenmemis olmali
    expect(await isRateLimited(ip, "TEST_SCOPE", 15 * 60 * 1000, 8)).toBe(false);
    await recordRateLimitHit(ip, "TEST_SCOPE");
    // 8. kayittan sonra esige ulasti
    expect(await isRateLimited(ip, "TEST_SCOPE", 15 * 60 * 1000, 8)).toBe(true);
  });

  it("farkli IP'ler birbirini etkilemez", async () => {
    const { isRateLimited, recordRateLimitHit } = await import("./rate-limit");
    for (let i = 0; i < 10; i += 1) await recordRateLimitHit("5.5.5.5", "TEST_SCOPE");
    expect(await isRateLimited("5.5.5.5", "TEST_SCOPE", 15 * 60 * 1000, 8)).toBe(true);
    expect(await isRateLimited("6.6.6.6", "TEST_SCOPE", 15 * 60 * 1000, 8)).toBe(false);
  });

  it("farkli scope'lar birbirini etkilemez (ayni IP)", async () => {
    const { isRateLimited, recordRateLimitHit } = await import("./rate-limit");
    for (let i = 0; i < 10; i += 1) await recordRateLimitHit("7.7.7.7", "SCOPE_A");
    expect(await isRateLimited("7.7.7.7", "SCOPE_A", 15 * 60 * 1000, 8)).toBe(true);
    expect(await isRateLimited("7.7.7.7", "SCOPE_B", 15 * 60 * 1000, 8)).toBe(false);
  });

  it("pencere disindaki eski kayitlar sayilmaz", async () => {
    const { isRateLimited } = await import("./rate-limit");
    const ip = "8.8.8.8";
    const old = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 dk once, 15 dk pencerenin disinda
    for (let i = 0; i < 10; i += 1) {
      await db.prepare("INSERT INTO audit_log (entity_id, action, payload, created_at) VALUES (?, 'TEST_SCOPE', '{}', ?)").bind(ip, old).run();
    }
    expect(await isRateLimited(ip, "TEST_SCOPE", 15 * 60 * 1000, 8)).toBe(false);
  });
});
