import { getGoogleAccessToken, hasGoogleConnection } from "../google-api";

// Google Business Profile - hicbir mutation yok, yalniz read-only account/location discovery.
// business.manage scope zaten /api/admin/google/oauth/start?scope=gbp altinda hazir (bkz.
// oauth/start/route.ts) - bu dosya, o OAuth akisi tamamlandiktan SONRA gercek API'yi cagirir.
// Safira/Destan eslesmesi ASLA isim benzerligiyle otomatik yapilmaz - yalniz admin'in acikca
// sectigi location kaydedilir (bkz. mapping.ts).

const ACCOUNT_MANAGEMENT_BASE = "https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const LOCATION_READ_MASK = "name,title,storefrontAddress,phoneNumbers,websiteUri,categories,regularHours";

export type GbpReadinessState =
  | "WAITING_API_ACCESS" // OAuth hic yapilmamis veya token yenilenemiyor
  | "ACCESS_DENIED" // OAuth var ama API 401/403 donuyor (scope/API etkin degil)
  | "WAITING_OWNER_ACCESS" // OAuth var, API calisiyor, ama bu Google hesabina bagli hicbir Business Profile hesabi yok
  | "NO_LOCATIONS" // hesap var ama hicbir location yok
  | "READY_READ_ONLY"; // account+location bulundu, yalniz okuma yapilabilir

export interface GbpAccount {
  name: string; // "accounts/{id}" - dahili kaynak adi, sunucu tarafinda tutulur
  accountName: string;
  type: string;
}

export interface GbpLocation {
  name: string; // "accounts/{id}/locations/{id}" - sunucu tarafinda tutulur, gereksiz yere client'a acilmaz
  title: string;
  address: string | null;
  phone: string | null;
  websiteUri: string | null;
  primaryCategory: string | null;
  hasHours: boolean;
}

export interface GbpDiscoveryResult {
  state: GbpReadinessState;
  accounts: GbpAccount[];
  locations: GbpLocation[];
  error: string | null;
}

type AccountsResponse = { accounts?: Array<{ name?: string; accountName?: string; type?: string }> };
type LocationsResponse = {
  locations?: Array<{
    name?: string;
    title?: string;
    storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string };
    phoneNumbers?: { primaryPhone?: string };
    websiteUri?: string;
    categories?: { primaryCategory?: { displayName?: string } };
    regularHours?: { periods?: unknown[] };
  }>;
};

function mapLocation(raw: NonNullable<LocationsResponse["locations"]>[number]): GbpLocation {
  const addressParts = [
    ...(raw.storefrontAddress?.addressLines ?? []),
    raw.storefrontAddress?.locality,
    raw.storefrontAddress?.administrativeArea,
  ].filter((part): part is string => Boolean(part));
  return {
    name: raw.name ?? "",
    title: raw.title ?? "(isimsiz)",
    address: addressParts.length > 0 ? addressParts.join(", ") : null,
    phone: raw.phoneNumbers?.primaryPhone ?? null,
    websiteUri: raw.websiteUri ?? null,
    primaryCategory: raw.categories?.primaryCategory?.displayName ?? null,
    hasHours: Boolean(raw.regularHours?.periods?.length),
  };
}

async function fetchLocationsForAccount(accountName: string, accessToken: string): Promise<GbpLocation[]> {
  const url = `${BUSINESS_INFO_BASE}/${accountName}/locations?readMask=${encodeURIComponent(LOCATION_READ_MASK)}&pageSize=100`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return [];
  const body = (await response.json().catch(() => ({}))) as LocationsResponse;
  return (body.locations ?? []).filter((loc) => loc.name).map(mapLocation);
}

export async function discoverGbpAccountsAndLocations(): Promise<GbpDiscoveryResult> {
  const connected = await hasGoogleConnection("gbp");
  if (!connected) {
    return { state: "WAITING_API_ACCESS", accounts: [], locations: [], error: null };
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken("gbp");
  } catch (error) {
    console.error(`[GBP] token refresh failed: ${error instanceof Error ? error.message : "unknown"}`);
    return { state: "WAITING_API_ACCESS", accounts: [], locations: [], error: "GBP OAuth tokenı yenilenemedi - yeniden bağlanmanız gerekebilir." };
  }

  const accountsResponse = await fetch(`${ACCOUNT_MANAGEMENT_BASE}/accounts`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (accountsResponse.status === 401 || accountsResponse.status === 403) {
    return { state: "ACCESS_DENIED", accounts: [], locations: [], error: `Business Profile API erişimi reddedildi (HTTP ${accountsResponse.status}) - Google Cloud projesinde API etkin mi ve OAuth kapsamı doğru mu kontrol edin.` };
  }
  if (!accountsResponse.ok) {
    console.error(`[GBP] accounts.list HTTP ${accountsResponse.status}`);
    return { state: "ACCESS_DENIED", accounts: [], locations: [], error: `Business Profile hesap listesi alınamadı (HTTP ${accountsResponse.status}).` };
  }

  const accountsBody = (await accountsResponse.json().catch(() => ({}))) as AccountsResponse;
  const accounts: GbpAccount[] = (accountsBody.accounts ?? [])
    .filter((a) => a.name)
    .map((a) => ({ name: a.name ?? "", accountName: a.accountName ?? "(isimsiz hesap)", type: a.type ?? "" }));

  if (accounts.length === 0) {
    // OAuth basarili, API calisiyor, ama bu Google hesabina bagli Business Profile hesabi yok -
    // Safira/Destan'in gercek sahibi FARKLI bir Google hesabiyla giris yapmis olabilir.
    return { state: "WAITING_OWNER_ACCESS", accounts: [], locations: [], error: null };
  }

  const locationLists = await Promise.all(accounts.map((account) => fetchLocationsForAccount(account.name, accessToken)));
  const locations = locationLists.flat();

  if (locations.length === 0) {
    return { state: "NO_LOCATIONS", accounts, locations: [], error: null };
  }

  return { state: "READY_READ_ONLY", accounts, locations, error: null };
}
