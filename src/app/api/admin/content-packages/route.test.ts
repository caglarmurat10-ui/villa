import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let generateResult: { ok: true; packages: unknown[] } | { ok: false; error: string } = { ok: true, packages: [] };
let listResult: unknown[] = [];

vi.mock("@/lib/platform-content-packages", () => ({
  generateAndStorePackages: async () => generateResult,
  listPlatformPackages: async () => listResult,
}));

function postRequest(body: unknown) {
  return new NextRequest("https://admin.safiradestan.com/api/admin/content-packages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/content-packages", () => {
  afterEach(() => {
    generateResult = { ok: true, packages: [] };
    listResult = [];
    vi.resetModules();
  });

  it("geçersiz istek (eksik alan) 400 döner", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira" }));
    expect(response.status).toBe(400);
  });

  it("property isolation / REAL_UPLOAD ihlali (generateAndStorePackages ok:false) 409 döner", async () => {
    generateResult = { ok: false, error: "property isolation ihlali" };
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira", mediaFileId: "x", theme: "Havuz", campaignId: "test" }));
    expect(response.status).toBe(409);
  });

  it("geçerli istek 201 ile paketleri döner", async () => {
    generateResult = { ok: true, packages: [{ platform: "instagram" }] };
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira", mediaFileId: "x", theme: "Havuz", campaignId: "test" }));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.packages).toHaveLength(1);
  });
});
