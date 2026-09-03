import { afterEach, describe, expect, it, vi } from "vitest";

let mappings: Record<string, { locationName: string; locationTitle: string; selectedAt: string } | null> = { Safira: null, Destan: null };
let ensureResult: { action: string; error: string | null } = { action: "unchanged", error: null };

vi.mock("@/lib/gbp/mapping", () => ({
  getAllGbpLocationMappings: async () => mappings,
}));
vi.mock("@/lib/gbp/profile", () => ({
  ensureGbpBookingLink: async () => ensureResult,
}));

function postRequest(body: unknown) {
  return new Request("https://admin.safiradestan.com/api/admin/google/gbp/sync-booking-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/google/gbp/sync-booking-link - iki mapping persist edilmeden mutation YOK", () => {
  afterEach(() => {
    mappings = { Safira: null, Destan: null };
    ensureResult = { action: "unchanged", error: null };
    vi.resetModules();
  });

  it("hicbir mapping yokken 409 doner, ensureGbpBookingLink hic cagirilmaz", async () => {
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira" }));
    expect(response.status).toBe(409);
  });

  it("yalniz Safira mapping'i varken (Destan eksik) YINE 409 doner - 'her ikisi de' kurali kati", async () => {
    mappings = { Safira: { locationName: "accounts/1/locations/1", locationTitle: "x", selectedAt: "now" }, Destan: null };
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira" }));
    expect(response.status).toBe(409);
  });

  it("her iki mapping de varken izin verir", async () => {
    mappings = {
      Safira: { locationName: "accounts/1/locations/1", locationTitle: "x", selectedAt: "now" },
      Destan: { locationName: "accounts/2/locations/2", locationTitle: "y", selectedAt: "now" },
    };
    ensureResult = { action: "unchanged", error: null };
    const { POST } = await import("./route");
    const response = await POST(postRequest({ villa: "Safira" }));
    expect(response.status).toBe(200);
  });
});
