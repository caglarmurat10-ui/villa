import { afterEach, describe, expect, it, vi } from "vitest";

let connectionExists = false;
let accessTokenThrows = false;
let accountsStatus = 200;
let accountsBody: unknown = { accounts: [] };
let locationsBody: unknown = { locations: [] };

vi.mock("../google-api", () => ({
  hasGoogleConnection: async () => connectionExists,
  getGoogleAccessToken: async () => {
    if (accessTokenThrows) throw new Error("GOOGLE_REFRESH_TOKEN_MISSING:gbp");
    return "fake-access-token";
  },
}));

const originalFetch = global.fetch;

function mockFetch() {
  global.fetch = vi.fn(async (url: string | URL) => {
    const href = url.toString();
    if (href.includes("mybusinessaccountmanagement")) {
      return new Response(JSON.stringify(accountsBody), { status: accountsStatus });
    }
    return new Response(JSON.stringify(locationsBody), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("discoverGbpAccountsAndLocations", () => {
  afterEach(() => {
    connectionExists = false;
    accessTokenThrows = false;
    accountsStatus = 200;
    accountsBody = { accounts: [] };
    locationsBody = { locations: [] };
    global.fetch = originalFetch;
    vi.resetModules();
  });

  it("OAuth hic yapilmamissa WAITING_API_ACCESS doner, hicbir API cagrisi yapmaz", async () => {
    connectionExists = false;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const { discoverGbpAccountsAndLocations } = await import("./adapter");
    const result = await discoverGbpAccountsAndLocations();
    expect(result.state).toBe("WAITING_API_ACCESS");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("token yenileme basarisizsa WAITING_API_ACCESS doner", async () => {
    connectionExists = true;
    accessTokenThrows = true;
    const { discoverGbpAccountsAndLocations } = await import("./adapter");
    const result = await discoverGbpAccountsAndLocations();
    expect(result.state).toBe("WAITING_API_ACCESS");
  });

  it("accounts.list 403 donerse ACCESS_DENIED doner", async () => {
    connectionExists = true;
    accountsStatus = 403;
    mockFetch();
    const { discoverGbpAccountsAndLocations } = await import("./adapter");
    const result = await discoverGbpAccountsAndLocations();
    expect(result.state).toBe("ACCESS_DENIED");
  });

  it("bagli hesapta hicbir GBP account yoksa WAITING_OWNER_ACCESS doner", async () => {
    connectionExists = true;
    accountsBody = { accounts: [] };
    mockFetch();
    const { discoverGbpAccountsAndLocations } = await import("./adapter");
    const result = await discoverGbpAccountsAndLocations();
    expect(result.state).toBe("WAITING_OWNER_ACCESS");
  });

  it("account var ama location yoksa NO_LOCATIONS doner", async () => {
    connectionExists = true;
    accountsBody = { accounts: [{ name: "accounts/1", accountName: "Test Hesap" }] };
    locationsBody = { locations: [] };
    mockFetch();
    const { discoverGbpAccountsAndLocations } = await import("./adapter");
    const result = await discoverGbpAccountsAndLocations();
    expect(result.state).toBe("NO_LOCATIONS");
  });

  it("account+location varsa READY_READ_ONLY doner ve gercek location alanlarini map'ler", async () => {
    connectionExists = true;
    accountsBody = { accounts: [{ name: "accounts/1", accountName: "Test Hesap" }] };
    locationsBody = {
      locations: [{
        name: "accounts/1/locations/99",
        title: "Villa Safira",
        storefrontAddress: { addressLines: ["Sahil Cad. No:1"], locality: "Kaş", administrativeArea: "Antalya" },
        phoneNumbers: { primaryPhone: "+905000000000" },
        websiteUri: "https://safiradestan.com/villa-safira",
        categories: { primaryCategory: { displayName: "Tatil evi kiralama" } },
      }],
    };
    mockFetch();
    const { discoverGbpAccountsAndLocations } = await import("./adapter");
    const result = await discoverGbpAccountsAndLocations();
    expect(result.state).toBe("READY_READ_ONLY");
    expect(result.locations).toHaveLength(1);
    expect(result.locations[0]).toMatchObject({
      name: "accounts/1/locations/99",
      title: "Villa Safira",
      phone: "+905000000000",
      primaryCategory: "Tatil evi kiralama",
    });
  });

  it("hicbir mutation cagrisi (PATCH/POST/PUT) yapmaz - yalniz GET", async () => {
    connectionExists = true;
    accountsBody = { accounts: [{ name: "accounts/1", accountName: "Test Hesap" }] };
    locationsBody = { locations: [{ name: "accounts/1/locations/1", title: "X" }] };
    const calls: string[] = [];
    global.fetch = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      calls.push(init?.method ?? "GET");
      const href = _url.toString();
      if (href.includes("mybusinessaccountmanagement")) return new Response(JSON.stringify(accountsBody), { status: 200 });
      return new Response(JSON.stringify(locationsBody), { status: 200 });
    }) as unknown as typeof fetch;
    const { discoverGbpAccountsAndLocations } = await import("./adapter");
    await discoverGbpAccountsAndLocations();
    expect(calls.every((method) => method === "GET")).toBe(true);
  });
});
