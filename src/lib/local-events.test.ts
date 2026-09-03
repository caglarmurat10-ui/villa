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
  return ["0019_local_event_candidates.sql"].map((name) => readFileSync(resolve(ROOT, "migrations", name), "utf-8")).join("\n");
}

const VALID_INPUT = {
  title: "Kaş Yamaç Paraşütü Festivali",
  eventDate: "2027-05-01",
  sourceName: "Kaş Belediyesi",
  sourceUrl: "https://kas.bel.tr/etkinlikler/yamac-parasutu",
};

describe("local-events.ts - Faz 6 bölüm 4 dinamik etkinlik motoru", () => {
  beforeEach(() => {
    db = createFakeD1(loadSchema());
  });
  afterEach(() => {
    db.close();
    vi.resetModules();
  });

  it("gecerli kaynakla bir aday olusturulur, varsayilan status='pending_review'", async () => {
    const { createLocalEventCandidate } = await import("./local-events");
    const candidate = await createLocalEventCandidate(VALID_INPUT);
    expect(candidate.status).toBe("pending_review");
    expect(candidate.sourceUrl).toBe(VALID_INPUT.sourceUrl);
    expect(candidate.id).toBeTruthy();
  });

  it("kaynak (sourceUrl/sourceName) olmadan aday OLUSTURULAMAZ", async () => {
    const { createLocalEventCandidate } = await import("./local-events");
    await expect(createLocalEventCandidate({ ...VALID_INPUT, sourceUrl: "" })).rejects.toThrow();
    await expect(createLocalEventCandidate({ ...VALID_INPUT, sourceName: "" })).rejects.toThrow();
  });

  it("hicbir yeni aday otomatik olarak 'approved' olmaz - yalniz explicit setLocalEventCandidateStatus degistirir", async () => {
    const { createLocalEventCandidate, setLocalEventCandidateStatus } = await import("./local-events");
    const candidate = await createLocalEventCandidate(VALID_INPUT);
    expect(candidate.status).toBe("pending_review");
    const approved = await setLocalEventCandidateStatus(candidate.id, "approved");
    expect(approved?.status).toBe("approved");
  });

  it("listLocalEventCandidates status filtresine gore dogru filtreler", async () => {
    const { createLocalEventCandidate, setLocalEventCandidateStatus, listLocalEventCandidates } = await import("./local-events");
    const a = await createLocalEventCandidate(VALID_INPUT);
    await createLocalEventCandidate({ ...VALID_INPUT, title: "İkinci Etkinlik", eventDate: "2027-06-01" });
    await setLocalEventCandidateStatus(a.id, "approved");

    const pending = await listLocalEventCandidates("pending_review");
    expect(pending).toHaveLength(1);
    const approved = await listLocalEventCandidates("approved");
    expect(approved).toHaveLength(1);
    expect(approved[0].id).toBe(a.id);
    const all = await listLocalEventCandidates();
    expect(all).toHaveLength(2);
  });

  it("getLocalEventCandidate olmayan bir id icin null doner", async () => {
    const { getLocalEventCandidate } = await import("./local-events");
    expect(await getLocalEventCandidate("no-such-id")).toBeNull();
  });

  it("isPastEvent gecmis tarihli adaylari dogru tespit eder", async () => {
    const { isPastEvent } = await import("./local-events");
    expect(isPastEvent({ eventDate: "2026-01-01" }, "2026-09-03")).toBe(true);
    expect(isPastEvent({ eventDate: "2027-01-01" }, "2026-09-03")).toBe(false);
  });
});
