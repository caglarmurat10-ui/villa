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
  return ["0001_schema.sql", "0023_social_growth_agent.sql"]
    .map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8"))
    .join("\n");
}

describe("social-growth-store", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("upsertProspect yeni bir kayıt oluşturur ve DISCOVERED durumuyla başlar", async () => {
    const { upsertProspect, listProspects } = await import("./social-growth-store");
    await upsertProspect({
      villa: "Destan", platform: "Instagram", username: "kas_gezgini", accountId: null, displayName: "Kaş Gezgini",
      category: "travel_creator", bioSummary: null, followersCount: 5000, mediaCount: 120, locationHint: "Kaş",
      relevanceScore: 80, engagementScore: 70, locationScore: 90, audienceFitScore: 75, spamRiskScore: 5,
      finalGrowthScore: 82, discoveredAt: new Date().toISOString(), lastCheckedAt: null,
    });
    const rows = await listProspects("Destan");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.username).toBe("kas_gezgini");
    expect(rows[0]?.status).toBe("DISCOVERED");
  });

  it("upsertProspect aynı platform+username için günceller, ikinci satır oluşturmaz", async () => {
    const { upsertProspect, listProspects } = await import("./social-growth-store");
    const base = {
      villa: "Safira" as const, platform: "Instagram", username: "patara_travel", accountId: null, displayName: null,
      category: "local_creator" as const, bioSummary: null, followersCount: 1000, mediaCount: 40, locationHint: "Patara",
      relevanceScore: 50, engagementScore: 50, locationScore: 50, audienceFitScore: 50, spamRiskScore: 10,
      finalGrowthScore: 50, discoveredAt: new Date().toISOString(), lastCheckedAt: null,
    };
    await upsertProspect(base);
    await upsertProspect({ ...base, followersCount: 1500, finalGrowthScore: 60 });
    const rows = await listProspects("Safira");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.followersCount).toBe(1500);
  });

  it("updateProspectStatus durumu değiştirir", async () => {
    const { upsertProspect, updateProspectStatus } = await import("./social-growth-store");
    const created = await upsertProspect({
      villa: "Destan", platform: "Instagram", username: "test_hesap", accountId: null, displayName: null,
      category: "tourism_page", bioSummary: null, followersCount: null, mediaCount: null, locationHint: null,
      relevanceScore: null, engagementScore: null, locationScore: null, audienceFitScore: null, spamRiskScore: null,
      finalGrowthScore: null, discoveredAt: new Date().toISOString(), lastCheckedAt: null,
    });
    const updated = await updateProspectStatus(created.id, "WATCHLIST");
    expect(updated?.status).toBe("WATCHLIST");
  });

  it("recordAgentRun ve listAgentRuns PENDING_PERMISSION çalışmalarını kaydeder", async () => {
    const { recordAgentRun, listAgentRuns } = await import("./social-growth-store");
    await recordAgentRun({ agentType: "SCOUT", status: "PENDING_PERMISSION", candidateCount: 0, requiredPermission: "Instagram Public Content Access" });
    const runs = await listAgentRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("PENDING_PERMISSION");
    expect(runs[0]?.agentType).toBe("SCOUT");
  });

  it("listOpportunities villa filtresine göre boş liste döner (henüz veri yok)", async () => {
    const { listOpportunities } = await import("./social-growth-store");
    const rows = await listOpportunities("Safira");
    expect(rows).toEqual([]);
  });
});
