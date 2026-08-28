import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({
  state: { env: { AI_IMAGE_ENABLED: "false", AI_VIDEO_ENABLED: "false" } as unknown as CloudflareEnv },
}));

vi.mock("@/lib/socialOperationsDb", () => ({
  socialOperationsDb: vi.fn(async () => ({ env: state.env, db: {} })),
  availabilityPriceText: vi.fn(),
  getSocialSettings: vi.fn(),
  listAvailability: vi.fn(),
}));

import { POST as createContent } from "@/app/api/social/ai/content/route";
import { GET as searchPexels } from "@/app/api/social/ai/pexels/route";
import { GET as sessionStatus } from "@/app/api/social/ai/session/route";

describe("opsiyonel AI route davranışı", () => {
  beforeEach(() => {
    state.env = { AI_IMAGE_ENABLED: "false", AI_VIDEO_ENABLED: "false" } as unknown as CloudflareEnv;
  });

  it("secretlar yokken AI ve Pexels endpointleri 500 yerine configured:false döndürür", async () => {
    const content = await createContent(new Request("https://villa.example/api/social/ai/content", {
      method: "POST", headers: { origin: "https://villa.example", "content-type": "application/json" }, body: "{}",
    }));
    expect(content.status).toBe(503);
    expect(await content.json()).toMatchObject({ configured: false, service: "admin" });

    const pexels = await searchPexels(new Request("https://villa.example/api/social/ai/pexels?kind=photo&query=Patara"));
    expect(pexels.status).toBe(503);
    expect(await pexels.json()).toMatchObject({ configured: false, service: "pexels" });
  });

  it("public durum cevabında yalnız boolean metadata bulunur", async () => {
    const response = await sessionStatus(new Request("https://villa.example/api/social/ai/session"));
    const body = await response.json() as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ configured: false, authenticated: false,
      configuration: { workersAiConfigured: false, primaryProvider: "workers-ai", openAiConfigured: false,
        paidFallbackEnabled: false, pexelsConfigured: false, adminConfigured: false, templateAvailable: true,
        aiEnabled: false, imageEnabled: false, videoEnabled: false, autopilotEnabled: false } });
    expect(JSON.stringify(body)).not.toMatch(/API_KEY|ADMIN_KEY|token|secret/i);
  });

  it("mock secretlar varken ücretli çağrıdan önce yönetici oturumu ister", async () => {
    state.env = { AI_IMAGE_ENABLED: "false", AI_VIDEO_ENABLED: "false", OPENAI_API_KEY: "mock-openai",
      PEXELS_API_KEY: "mock-pexels", SOCIAL_AI_ADMIN_KEY: "mock-admin-key-long-enough" } as unknown as CloudflareEnv;
    const response = await createContent(new Request("https://villa.example/api/social/ai/content", {
      method: "POST", headers: { origin: "https://villa.example", "content-type": "application/json" },
      body: JSON.stringify({ villa: "Destan", mode: "quick", purpose: "villa" }),
    }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "Yetkili oturum gerekli." });
  });
});
