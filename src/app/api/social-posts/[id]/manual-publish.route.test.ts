// PATCH /api/social-posts/[id] manuel yayın aksiyonları (bölüm 6/12/18 test 8) - "ready" adımı
// atlanıp doğrudan "confirm" çağrılamaz; onaylanmamış içerik manuel yayına hazırlanamaz.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SocialPost } from "@/lib/types";

let current: SocialPost | null = null;
let readyCalls = 0;
let confirmCalls = 0;

function post(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "p1", villa: "Destan", platform: "Instagram", contentType: "Gönderi",
    scheduledDate: "2026-09-20", caption: "test", status: "Planlandı",
    approvalStatus: "Onaylandı", approvedAt: "now", publishedAt: null,
    platformPostId: null, publishAttemptCount: 0, lastPublishAttemptAt: null,
    lastPublishError: null, manualPublishState: null, manuallyPublishedAt: null,
    createdAt: "now", updatedAt: "now",
    ...overrides,
  };
}

vi.mock("@/lib/social-db", () => ({
  getSocialPost: async () => current,
  markReadyForManualPublish: async () => { readyCalls += 1; return current ? { ...current, manualPublishState: "READY_FOR_MANUAL_PUBLISH" } : null; },
  markManuallyPublished: async () => { confirmCalls += 1; return current ? { ...current, manualPublishState: "MANUALLY_PUBLISHED", status: "Yayınlandı" } : null; },
  updateSocialPostApproval: async () => current,
  updateSocialPostStatus: async () => current,
  deleteSocialPost: async () => true,
}));
vi.mock("@/lib/social-drive-media", () => ({ approvedProxyMediaAsset: () => null }));
vi.mock("@/lib/social-media-store", () => ({ deleteSocialPostMedia: async () => {}, replaceSocialPostMedia: async () => [] }));

function patchRequest(body: unknown) {
  return new Request("https://admin.safiradestan.com/api/social-posts/p1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/social-posts/[id] - manuel yayın (ready/confirm)", () => {
  afterEach(() => {
    current = null;
    readyCalls = 0;
    confirmCalls = 0;
    vi.resetModules();
  });

  it("onaylanmamış (İnsan onayı) bir içerik 'ready' aksiyonuyla manuel yayına hazırlanamaz - 409", async () => {
    current = post({ approvalStatus: "İnsan onayı" });
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ manualPublishAction: "ready" }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(409);
    expect(readyCalls).toBe(0);
  });

  it("onaylı içerik 'ready' aksiyonuyla başarıyla hazırlanır - 200, manualPublishState READY", async () => {
    current = post();
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ manualPublishAction: "ready" }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(200);
    expect(readyCalls).toBe(1);
    const data = await response.json();
    expect(data.post.manualPublishState).toBe("READY_FOR_MANUAL_PUBLISH");
  });

  it("READY aşaması ATLANIP doğrudan 'confirm' çağrılırsa 409 döner - manualPublishState henüz READY değil", async () => {
    current = post({ manualPublishState: null });
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ manualPublishAction: "confirm" }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(409);
    expect(confirmCalls).toBe(0);
  });

  it("READY durumundaki içerik 'confirm' ile başarıyla MANUALLY_PUBLISHED olur", async () => {
    current = post({ manualPublishState: "READY_FOR_MANUAL_PUBLISH" });
    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ manualPublishAction: "confirm" }), { params: Promise.resolve({ id: "p1" }) });
    expect(response.status).toBe(200);
    expect(confirmCalls).toBe(1);
    const data = await response.json();
    expect(data.post.manualPublishState).toBe("MANUALLY_PUBLISHED");
    // KRİTİK: sağlayıcı (Meta API) yayın alanı bu yolla ASLA set edilmez.
    expect(data.post.platformPostId).toBeNull();
  });

  it("zaten yayınlanmış (status='Yayınlandı') bir içerik için hiçbir manuel yayın aksiyonu kabul edilmez - 409", async () => {
    current = post({ status: "Yayınlandı" });
    const { PATCH } = await import("./route");
    const readyResponse = await PATCH(patchRequest({ manualPublishAction: "ready" }), { params: Promise.resolve({ id: "p1" }) });
    expect(readyResponse.status).toBe(409);
    const confirmResponse = await PATCH(patchRequest({ manualPublishAction: "confirm" }), { params: Promise.resolve({ id: "p1" }) });
    expect(confirmResponse.status).toBe(409);
  });
});
