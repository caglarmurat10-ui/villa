import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeD1, type FakeD1 } from "./test-utils/fake-d1";
import type { NewProspectInput } from "./social-growth-store";

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

function baseInput(overrides: Partial<NewProspectInput> = {}): NewProspectInput {
  return {
    villa: "Destan", platform: "Instagram", username: "kas_gezgini", accountId: null, displayName: "Kaş Gezgini",
    profileUrl: "https://instagram.com/kas_gezgini", category: "travel_creator", bioSummary: null,
    followersCount: 5000, mediaCount: 120, locationHint: "Kaş",
    relevanceScore: 80, engagementScore: 70, locationScore: 90, audienceFitScore: 75, spamRiskScore: 5,
    finalGrowthScore: 82, discoveredAt: new Date().toISOString(), lastCheckedAt: null,
    sourceType: "manual_entry", sourceUrl: null, shortReason: null,
    ...overrides,
  };
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
    await upsertProspect(baseInput());
    const rows = await listProspects({ villa: "Destan" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.username).toBe("kas_gezgini");
    expect(rows[0]?.status).toBe("DISCOVERED");
  });

  it("upsertProspect aynı platform+username için günceller, ikinci satır oluşturmaz", async () => {
    const { upsertProspect, listProspects } = await import("./social-growth-store");
    const base = baseInput({ villa: "Safira", username: "patara_travel", category: "local_creator", followersCount: 1000, finalGrowthScore: 50 });
    await upsertProspect(base);
    await upsertProspect({ ...base, followersCount: 1500, finalGrowthScore: 60 });
    const rows = await listProspects({ villa: "Safira" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.followersCount).toBe(1500);
  });

  it("createManualProspect yeni hesabı DISCOVERED + manual_entry olarak ekler", async () => {
    const { createManualProspect } = await import("./social-growth-store");
    const result = await createManualProspect(baseInput({ username: "travelkas_manual" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.prospect.status).toBe("DISCOVERED");
      expect(result.prospect.sourceType).toBe("manual_entry");
    }
  });

  it("createManualProspect aynı platform+username için AÇIKÇA reddeder (sessizce güncellemez)", async () => {
    const { createManualProspect } = await import("./social-growth-store");
    const input = baseInput({ username: "dup_hesap" });
    const first = await createManualProspect(input);
    expect(first.ok).toBe(true);
    const second = await createManualProspect(input);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toContain("zaten ekli");
  });

  it("updateProspectStatus WATCHLIST/FOLLOWED_MANUALLY/BLOCKED durumlarını destekler", async () => {
    const { upsertProspect, updateProspectStatus } = await import("./social-growth-store");
    const created = await upsertProspect(baseInput({ username: "test_hesap", category: "tourism_page" }));
    expect((await updateProspectStatus(created.id, "WATCHLIST"))?.status).toBe("WATCHLIST");
    expect((await updateProspectStatus(created.id, "FOLLOWED_MANUALLY"))?.status).toBe("FOLLOWED_MANUALLY");
    expect((await updateProspectStatus(created.id, "BLOCKED"))?.status).toBe("BLOCKED");
  });

  it("listProspects discoveredOn ile bugünün keşiflerini filtreler", async () => {
    const { upsertProspect, listProspects } = await import("./social-growth-store");
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    await upsertProspect(baseInput({ username: "bugun_hesap", discoveredAt: today }));
    await upsertProspect(baseInput({ username: "dun_hesap", discoveredAt: yesterday }));
    const rows = await listProspects({ discoveredOn: today.slice(0, 10) });
    expect(rows.map((r) => r.username)).toEqual(["bugun_hesap"]);
  });

  it("listProspects statuses filtresiyle yalnız istenen durumları döner", async () => {
    const { upsertProspect, updateProspectStatus, listProspects } = await import("./social-growth-store");
    const a = await upsertProspect(baseInput({ username: "a_hesap" }));
    await upsertProspect(baseInput({ username: "b_hesap" }));
    await updateProspectStatus(a.id, "WATCHLIST");
    const rows = await listProspects({ statuses: ["WATCHLIST"] });
    expect(rows.map((r) => r.username)).toEqual(["a_hesap"]);
  });

  it("recordAgentRun PENDING_CONFIGURATION durumunu kaydedebilir (arama API anahtarı yokken)", async () => {
    const { recordAgentRun, listAgentRuns } = await import("./social-growth-store");
    await recordAgentRun({ agentType: "SCOUT", status: "PENDING_CONFIGURATION", candidateCount: 0, notes: "arama API anahtarı tanımlı değil" });
    const runs = await listAgentRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("PENDING_CONFIGURATION");
  });

  it("createOpportunity RECOMMENDED durumuyla bir etkileşim fırsatı oluşturur", async () => {
    const { createOpportunity, listOpportunities } = await import("./social-growth-store");
    await createOpportunity({
      villa: "Destan", prospectId: null, targetUsername: "kas_gezgini", mediaLink: null,
      context: "Patara hakkında paylaşım", suggestedComment: "Patara'nın gün batımı gerçekten başka 🌿", riskClassification: "REVIEW_REQUIRED",
    });
    const rows = await listOpportunities("Destan");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("RECOMMENDED");
    expect(rows[0]?.riskClassification).toBe("REVIEW_REQUIRED");
  });

  it("listOpportunities villa filtresine göre boş liste döner (henüz veri yok)", async () => {
    const { listOpportunities } = await import("./social-growth-store");
    const rows = await listOpportunities("Safira");
    expect(rows).toEqual([]);
  });
});
