import { getGoogleAccessToken } from "../google-api";
import type { Villa } from "../types";

// Faz 6.1 bölüm 5 - GBP "booking link" alanı, Business Information API'nin Location kaynağındaki
// websiteUri alanıdır (adapter.ts'in kendi read-only discovery'sinde ZATEN okunan aynı alan -
// yeni bir varsayım UYDURULMADI, mevcut modele uyuldu). Güncelleme updateMask=websiteUri ile
// KESİN OLARAK yalnız bu tek alana sınırlanır - isim/adres/telefon/kategori/çalışma saatleri
// gövdeye hiç dahil edilmez, bu yüzden Google'ın PATCH semantiği gereği değişmeleri mümkün değildir.

const BUSINESS_INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";

const FIRST_PARTY_BOOKING_PAGE: Record<Villa, string> = {
  Safira: "https://safiradestan.com/villa-safira",
  Destan: "https://safiradestan.com/villa-destan",
};

export function expectedGbpBookingLink(villa: Villa): string {
  const url = new URL(FIRST_PARTY_BOOKING_PAGE[villa]);
  url.searchParams.set("utm_source", "google");
  url.searchParams.set("utm_medium", "organic_gbp");
  url.searchParams.set("utm_campaign", "booking");
  return url.toString();
}

export interface GbpProfileReadResult {
  ok: boolean;
  websiteUri: string | null;
  error: string | null;
}

export async function readGbpWebsiteUri(locationName: string): Promise<GbpProfileReadResult> {
  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken("gbp");
  } catch (error) {
    return { ok: false, websiteUri: null, error: error instanceof Error ? error.message : "GBP OAuth tokenı alınamadı." };
  }
  const url = `${BUSINESS_INFO_BASE}/${locationName}?readMask=websiteUri`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    console.error(`[GBP Profile] websiteUri okuma HTTP ${response.status}: ${bodyText.slice(0, 200)}`);
    return { ok: false, websiteUri: null, error: `HTTP ${response.status}` };
  }
  const body = (await response.json().catch(() => ({}))) as { websiteUri?: string };
  return { ok: true, websiteUri: body.websiteUri ?? null, error: null };
}

export interface GbpBookingLinkResult {
  villa: Villa;
  locationName: string;
  action: "unchanged" | "updated" | "blocked";
  previousUri: string | null;
  targetUri: string;
  verifiedUri: string | null;
  error: string | null;
}

// yalnız websiteUri farklıysa (veya boşsa) YAZAR - zaten doğruysa hiçbir mutation yapmaz. PATCH
// sonrası AYNI alan tekrar okunup beklenen değerle eşleştiği doğrulanmadan "updated" denmez.
export async function ensureGbpBookingLink(villa: Villa, locationName: string): Promise<GbpBookingLinkResult> {
  const target = expectedGbpBookingLink(villa);
  const current = await readGbpWebsiteUri(locationName);
  if (!current.ok) {
    return { villa, locationName, action: "blocked", previousUri: null, targetUri: target, verifiedUri: null, error: current.error };
  }
  if (current.websiteUri === target) {
    return { villa, locationName, action: "unchanged", previousUri: current.websiteUri, targetUri: target, verifiedUri: current.websiteUri, error: null };
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken("gbp");
  } catch (error) {
    return { villa, locationName, action: "blocked", previousUri: current.websiteUri, targetUri: target, verifiedUri: null, error: error instanceof Error ? error.message : "GBP OAuth tokenı alınamadı." };
  }

  const patchUrl = `${BUSINESS_INFO_BASE}/${locationName}?updateMask=websiteUri`;
  const response = await fetch(patchUrl, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ websiteUri: target }),
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    console.error(`[GBP Profile] websiteUri PATCH HTTP ${response.status}: ${bodyText.slice(0, 200)}`);
    return { villa, locationName, action: "blocked", previousUri: current.websiteUri, targetUri: target, verifiedUri: null, error: `HTTP ${response.status}` };
  }

  const readBack = await readGbpWebsiteUri(locationName);
  if (!readBack.ok || readBack.websiteUri !== target) {
    console.error(`[GBP Profile] websiteUri read-back doğrulaması başarısız: villa=${villa} beklenen=${target} okunan=${readBack.websiteUri ?? "null"}`);
    return { villa, locationName, action: "blocked", previousUri: current.websiteUri, targetUri: target, verifiedUri: readBack.websiteUri, error: "Yazıldı ama doğrulanamadı." };
  }

  return { villa, locationName, action: "updated", previousUri: current.websiteUri, targetUri: target, verifiedUri: readBack.websiteUri, error: null };
}
