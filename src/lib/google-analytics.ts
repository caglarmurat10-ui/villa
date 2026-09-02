import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getGoogleAccessToken, hasGoogleConnection } from "./google-api";

const CACHE_KEY = "cache:ga4:summary:v1";
const CACHE_TTL_SECONDS = 15 * 60;
const TARGET_DOMAIN = "safiradestan.com";

// analytics.ts'in dataLayer'a push ettigi event isimleriyle birebir eslesir (bkz. src/lib/analytics.ts
// trackWhatsappClick/trackPhoneClick/trackMapsClick vb.) - GTM-KFZ62MJG konteynerinin bu event'leri
// GA4'e gercekten ilettigini dogrulamanin tek yolu, GA4 Data API'den geri okumak.
const TRACKED_EVENT_NAMES = [
  "generate_lead",
  "check_availability",
  "whatsapp_click",
  "phone_click",
  "maps_click",
] as const;

export type Ga4EventKpi = { eventName: string; count: number };

export type Ga4Summary = {
  property: string;
  propertyId: string;
  propertyDisplayName: string;
  streamName: string;
  streamDisplayName: string;
  measurementId: string;
  defaultUri: string;
  startDate: string;
  endDate: string;
  activeUsers: number;
  sessions: number;
  views: number;
  engagedSessions: number;
  eventKpis: Ga4EventKpi[];
};

export type Ga4Probe = {
  connected: boolean;
  ready: boolean;
  data: Ga4Summary | null;
  error: string | null;
};

type AccountSummariesResponse = {
  accountSummaries?: Array<{
    propertySummaries?: Array<{
      property?: string;
      displayName?: string;
    }>;
  }>;
};

type DataStreamsResponse = {
  dataStreams?: Array<{
    name?: string;
    type?: string;
    displayName?: string;
    webStreamData?: {
      measurementId?: string;
      defaultUri?: string;
    };
  }>;
};

type RunReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

function matchesTargetDomain(defaultUri?: string) {
  if (!defaultUri) return false;
  try {
    const hostname = new URL(defaultUri).hostname.toLowerCase().replace(/^www\./, "");
    return hostname === TARGET_DOMAIN;
  } catch {
    return defaultUri.toLowerCase().includes(TARGET_DOMAIN);
  }
}

async function googleJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    console.error(`[GA4 Admin] GET HTTP ${response.status}`);
    throw new Error(`GA4_ADMIN_API_FAILED:${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function discoverTargetProperty(accessToken: string) {
  const summaries = await googleJson<AccountSummariesResponse>(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
    accessToken,
  );

  const properties = (summaries.accountSummaries ?? [])
    .flatMap((account) => account.propertySummaries ?? [])
    .filter((item): item is { property: string; displayName?: string } => Boolean(item.property));

  const prioritized = [...properties].sort((a, b) => {
    const aMatch = `${a.displayName ?? ""}`.toLowerCase().includes("safira") || `${a.displayName ?? ""}`.toLowerCase().includes("destan") ? 0 : 1;
    const bMatch = `${b.displayName ?? ""}`.toLowerCase().includes("safira") || `${b.displayName ?? ""}`.toLowerCase().includes("destan") ? 0 : 1;
    return aMatch - bMatch;
  });

  for (const item of prioritized.slice(0, 50)) {
    const streams = await googleJson<DataStreamsResponse>(
      `https://analyticsadmin.googleapis.com/v1beta/${item.property}/dataStreams?pageSize=50`,
      accessToken,
    );
    const stream = (streams.dataStreams ?? []).find((candidate) =>
      candidate.type === "WEB_DATA_STREAM" && matchesTargetDomain(candidate.webStreamData?.defaultUri),
    );
    if (stream) return { property: item, stream };
  }

  throw new Error("GA4_TARGET_WEB_STREAM_NOT_FOUND");
}

async function runLiveReport(accessToken: string, property: string) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "engagedSessions" },
      ],
    }),
  });
  if (!response.ok) {
    console.error(`[GA4 Data] runReport HTTP ${response.status}`);
    throw new Error(`GA4_DATA_API_FAILED:${response.status}`);
  }
  return response.json() as Promise<RunReportResponse>;
}

async function runEventReport(accessToken: string, property: string): Promise<Ga4EventKpi[]> {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/${property}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: { values: [...TRACKED_EVENT_NAMES] },
        },
      },
      limit: TRACKED_EVENT_NAMES.length,
    }),
  });
  if (!response.ok) {
    console.error(`[GA4 Data] event runReport HTTP ${response.status}`);
    // Ozel event raporu basarisiz olsa bile ana KPI'lari (users/sessions/views) dusurmemek icin
    // burada throw etmiyoruz - loadLiveSummary bos eventKpis ile devam eder.
    return TRACKED_EVENT_NAMES.map((eventName) => ({ eventName, count: 0 }));
  }
  const body = await response.json() as RunReportResponse;
  const counts = new Map<string, number>();
  for (const row of body.rows ?? []) {
    const name = row.dimensionValues?.[0]?.value;
    if (!name) continue;
    counts.set(name, Number(row.metricValues?.[0]?.value ?? 0));
  }
  return TRACKED_EVENT_NAMES.map((eventName) => ({ eventName, count: counts.get(eventName) ?? 0 }));
}

async function loadLiveSummary(): Promise<Ga4Summary> {
  const accessToken = await getGoogleAccessToken("ga4");
  const { property, stream } = await discoverTargetProperty(accessToken);
  const [report, eventKpis] = await Promise.all([
    runLiveReport(accessToken, property.property),
    runEventReport(accessToken, property.property),
  ]);
  const metrics = report.rows?.[0]?.metricValues ?? [];
  const propertyId = property.property.replace(/^properties\//, "");

  return {
    property: property.property,
    propertyId,
    propertyDisplayName: property.displayName ?? property.property,
    streamName: stream.name ?? "",
    streamDisplayName: stream.displayName ?? "",
    measurementId: stream.webStreamData?.measurementId ?? "",
    defaultUri: stream.webStreamData?.defaultUri ?? "",
    startDate: "28daysAgo",
    endDate: "yesterday",
    activeUsers: Number(metrics[0]?.value ?? 0),
    sessions: Number(metrics[1]?.value ?? 0),
    views: Number(metrics[2]?.value ?? 0),
    engagedSessions: Number(metrics[3]?.value ?? 0),
    eventKpis,
  };
}

export async function getGa4Probe(): Promise<Ga4Probe> {
  const connected = await hasGoogleConnection("ga4");
  if (!connected) return { connected: false, ready: false, data: null, error: null };

  const { env } = await getCloudflareContext({ async: true });
  if (env.GOOGLE_PRIVATE) {
    const cached = await env.GOOGLE_PRIVATE.get(CACHE_KEY);
    if (cached) {
      try {
        return { connected: true, ready: true, data: JSON.parse(cached) as Ga4Summary, error: null };
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
    console.error(`[GA4] probe failed: ${error instanceof Error ? error.message : "unknown"}`);
    return {
      connected: true,
      ready: false,
      data: null,
      error: "GA4 API erişimi doğrulanamadı. Analytics Admin API/Data API ve web stream yetkisini kontrol edin.",
    };
  }
}
