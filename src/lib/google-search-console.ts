import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getGoogleAccessToken, hasGoogleConnection } from "./google-api";

const CACHE_KEY = "cache:search_console:summary:v1";
const CACHE_TTL_SECONDS = 15 * 60;
const TARGET_DOMAIN = "safiradestan.com";

export type SearchConsoleTopQuery = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleSummary = {
  siteUrl: string;
  startDate: string;
  endDate: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topQueries: SearchConsoleTopQuery[];
};

export type SearchConsoleProbe = {
  connected: boolean;
  ready: boolean;
  data: SearchConsoleSummary | null;
  error: string | null;
};

type SitesResponse = {
  siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>;
};

type SearchAnalyticsRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type SearchAnalyticsResponse = {
  rows?: SearchAnalyticsRow[];
};

function isoDateUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function complete28DayRange() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: isoDateUtc(start), endDate: isoDateUtc(end) };
}

function chooseSite(entries: NonNullable<SitesResponse["siteEntry"]>) {
  const urls = entries.map((entry) => entry.siteUrl).filter((value): value is string => Boolean(value));
  const preferred = [
    `sc-domain:${TARGET_DOMAIN}`,
    `https://${TARGET_DOMAIN}/`,
    `https://www.${TARGET_DOMAIN}/`,
    `http://${TARGET_DOMAIN}/`,
    `http://www.${TARGET_DOMAIN}/`,
  ];
  for (const candidate of preferred) {
    if (urls.includes(candidate)) return candidate;
  }
  return urls.find((siteUrl) => siteUrl.toLowerCase().includes(TARGET_DOMAIN)) ?? null;
}

async function searchAnalytics(accessToken: string, siteUrl: string, body: Record<string, unknown>) {
  const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error(`[Search Console] searchAnalytics HTTP ${response.status}`);
    throw new Error(`SEARCH_CONSOLE_QUERY_FAILED:${response.status}`);
  }
  return response.json() as Promise<SearchAnalyticsResponse>;
}

async function loadLiveSummary(): Promise<SearchConsoleSummary> {
  const accessToken = await getGoogleAccessToken("search_console");
  const sitesResponse = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!sitesResponse.ok) {
    console.error(`[Search Console] sites.list HTTP ${sitesResponse.status}`);
    throw new Error(`SEARCH_CONSOLE_SITES_FAILED:${sitesResponse.status}`);
  }

  const sites = await sitesResponse.json() as SitesResponse;
  const siteUrl = chooseSite(sites.siteEntry ?? []);
  if (!siteUrl) throw new Error("SEARCH_CONSOLE_SITE_NOT_FOUND");

  const { startDate, endDate } = complete28DayRange();
  const [aggregate, topQueriesResponse] = await Promise.all([
    searchAnalytics(accessToken, siteUrl, { startDate, endDate, rowLimit: 1 }),
    searchAnalytics(accessToken, siteUrl, { startDate, endDate, dimensions: ["query"], rowLimit: 5 }),
  ]);

  const row = aggregate.rows?.[0];
  const topQueries = (topQueriesResponse.rows ?? []).map((item) => ({
    query: item.keys?.[0] ?? "",
    clicks: Number(item.clicks ?? 0),
    impressions: Number(item.impressions ?? 0),
    ctr: Number(item.ctr ?? 0),
    position: Number(item.position ?? 0),
  })).filter((item) => item.query);

  return {
    siteUrl,
    startDate,
    endDate,
    clicks: Number(row?.clicks ?? 0),
    impressions: Number(row?.impressions ?? 0),
    ctr: Number(row?.ctr ?? 0),
    position: Number(row?.position ?? 0),
    topQueries,
  };
}

export async function getSearchConsoleProbe(): Promise<SearchConsoleProbe> {
  const connected = await hasGoogleConnection("search_console");
  if (!connected) return { connected: false, ready: false, data: null, error: null };

  const { env } = await getCloudflareContext({ async: true });
  if (env.GOOGLE_PRIVATE) {
    const cached = await env.GOOGLE_PRIVATE.get(CACHE_KEY);
    if (cached) {
      try {
        return { connected: true, ready: true, data: JSON.parse(cached) as SearchConsoleSummary, error: null };
      } catch {
        await env.GOOGLE_PRIVATE.delete(CACHE_KEY);
      }
    }
  }

  try {
    const data = await loadLiveSummary();
    if (env.GOOGLE_PRIVATE) {
      await env.GOOGLE_PRIVATE.put(CACHE_KEY, JSON.stringify(data), { expirationTtl: CACHE_TTL_SECONDS });
    }
    return { connected: true, ready: true, data, error: null };
  } catch (error) {
    console.error(`[Search Console] probe failed: ${error instanceof Error ? error.message : "unknown"}`);
    return {
      connected: true,
      ready: false,
      data: null,
      error: "Search Console API erişimi doğrulanamadı. API etkinleştirme ve property yetkisini kontrol edin.",
    };
  }
}
