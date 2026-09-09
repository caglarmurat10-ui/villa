import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let setCalls: Array<{ villa: string; platform: string; status: string; note?: string }> = [];

vi.mock("@/lib/map-presence", async () => {
  const actual = await vi.importActual<typeof import("@/lib/map-presence")>("@/lib/map-presence");
  return {
    ...actual,
    listMapPresence: async () => [],
    setMapPresenceStatus: async (villa: string, platform: string, status: string, note?: string) => {
      setCalls.push({ villa, platform, status, note });
      return { villa, platform, status, note: note ?? "", updatedAt: "now" };
    },
  };
});

function postRequest(body: unknown) {
  return new NextRequest("https://admin.safiradestan.com/api/admin/map-presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/map-presence", () => {
  afterEach(() => {
    setCalls = [];
    vi.resetModules();
  });

  it("geçersiz platform değeri (sabit listede yok) 400 döner", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira", platform: "BINGMAPS", status: "VERIFIED" }));
    expect(response.status).toBe(400);
    expect(setCalls).toHaveLength(0);
  });

  it("geçersiz status değeri (sabit listede yok) 400 döner", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira", platform: "GOOGLE", status: "MAYBE" }));
    expect(response.status).toBe(400);
    expect(setCalls).toHaveLength(0);
  });

  it("geçerli istek durumu günceller ve 200 döner", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Destan", platform: "APPLE", status: "CLAIM_STARTED", note: "test" }));
    expect(response.status).toBe(200);
    expect(setCalls).toEqual([{ villa: "Destan", platform: "APPLE", status: "CLAIM_STARTED", note: "test" }]);
  });
});
