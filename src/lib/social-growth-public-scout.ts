import type { KVNamespace } from "@cloudflare/workers-types";
import { upsertProspect, type ProspectCategory } from "./social-growth-store";
import { computeScores } from "./social-growth-scoring";
import { TARGET_LOCATIONS } from "./social-growth-constants";

// Public Web Scout - Meta API'ye HİÇ dokunmaz, Instagram'a login/cookie/scraping YAPMAZ. Yalnız
// Google Programmable Search Engine'in resmi Custom Search JSON API'siyle, herkese açık web
// arama sonuçlarını (indexlenmiş sayfalar) sorgular ve instagram.com profil linklerini ayıklar.
// Bu, ToS-uyumlu, resmi bir arama API'sidir - "public web search/index sonuçları" talebini
// tam olarak karşılar.
//
// GÜVENLİ VARSAYILAN: SOCIAL_SCOUT_SEARCH_API_KEY / SOCIAL_SCOUT_SEARCH_ENGINE_ID Cloudflare'de
// tanımlı DEĞİLSE bu modül hiçbir dış HTTP isteği ATMAZ (bkz. runPublicWebScout ilk kontrol).
// wrangler.jsonc secrets.required listesine BİLİNÇLİ olarak eklenmedi - PayTR ile aynı desen
// (dormant-by-design, deploy'u bloklamaz).

export { TARGET_LOCATIONS };

export const SCOUT_CATEGORY_QUERY_HINTS: Partial<Record<ProspectCategory, string>> = {
  travel_creator: "travel creator",
  local_creator: "local guide",
  tourism_page: "tourism",
  photographer: "photographer",
  food_creator: "food blogger",
  family_travel: "family travel",
  lifestyle_creator: "lifestyle",
  local_business: "local business",
};

export type ScoutQuery = { location: string; category: ProspectCategory; q: string };

const SCOUT_MATRIX: ScoutQuery[] = TARGET_LOCATIONS.flatMap((location) =>
  (Object.entries(SCOUT_CATEGORY_QUERY_HINTS) as [ProspectCategory, string][]).map(([category, hint]) => ({
    location,
    category,
    q: `"${hint}" "${location}" instagram`,
  })),
);

// Bir çalıştırmada tüm 72 kombinasyonu değil, sırayla küçük bir dilim denenir - hem Google Custom
// Search günlük ücretsiz kotasını (100 sorgu/gün) korur hem "aynı gün tüm kombinasyonlar" yerine
// zamana yayılmış, çeşitli bir keşif sağlar.
export function buildScoutQueries(cursorIndex: number, count: number): { queries: ScoutQuery[]; nextCursor: number } {
  const safeCount = Math.max(1, Math.min(SCOUT_MATRIX.length, count));
  const start = ((cursorIndex % SCOUT_MATRIX.length) + SCOUT_MATRIX.length) % SCOUT_MATRIX.length;
  const queries: ScoutQuery[] = [];
  for (let i = 0; i < safeCount; i += 1) {
    queries.push(SCOUT_MATRIX[(start + i) % SCOUT_MATRIX.length]!);
  }
  return { queries, nextCursor: (start + safeCount) % SCOUT_MATRIX.length };
}

export type GoogleSearchItem = { title?: string; link?: string; snippet?: string; displayLink?: string };
export type ParsedCandidate = {
  username: string;
  profileUrl: string;
  sourceUrl: string;
  shortReason: string;
  category: ProspectCategory;
  locationHint: string;
};

const NON_PROFILE_PATH_SEGMENTS = new Set(["p", "reel", "reels", "explore", "tv", "accounts", "direct", "stories"]);

// Yalnız gerçek profil linklerini (instagram.com/<username>/) alır - /p/, /reel/ gibi tekil
// gönderi linklerini profil sanıp yanlış username çıkarmaz.
export function parseSearchResultsToCandidates(items: GoogleSearchItem[], category: ProspectCategory, locationHint: string): ParsedCandidate[] {
  const seen = new Set<string>();
  const results: ParsedCandidate[] = [];
  for (const item of items) {
    if (!item.link) continue;
    let url: URL;
    try {
      url = new URL(item.link);
    } catch {
      continue;
    }
    if (!/(^|\.)instagram\.com$/i.test(url.hostname)) continue;
    const segment = url.pathname.split("/").filter(Boolean)[0];
    if (!segment || NON_PROFILE_PATH_SEGMENTS.has(segment.toLowerCase())) continue;
    const username = segment.toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(username) || seen.has(username)) continue;
    seen.add(username);
    results.push({
      username,
      profileUrl: `https://www.instagram.com/${username}/`,
      sourceUrl: item.link,
      shortReason: (item.snippet ?? item.title ?? "").slice(0, 240),
      category,
      locationHint,
    });
  }
  return results;
}

type GoogleSearchResponse = { items?: GoogleSearchItem[]; error?: { message?: string } };

async function searchGoogle(apiKey: string, engineId: string, query: string): Promise<GoogleSearchItem[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", engineId);
  url.searchParams.set("q", query);
  url.searchParams.set("siteSearch", "instagram.com");
  url.searchParams.set("siteSearchFilter", "i");
  url.searchParams.set("num", "10");
  const response = await fetch(url.toString());
  const payload = (await response.json().catch(() => ({}))) as GoogleSearchResponse;
  if (!response.ok) throw new Error(payload.error?.message ?? `Google Custom Search HTTP ${response.status}`);
  return payload.items ?? [];
}

export type PublicScoutRunResult =
  | { configured: false; reason: string }
  | { configured: true; queriesRun: number; candidatesFound: number; inserted: number; errors: number };

const CURSOR_KV_KEY = "social_public_scout_query_cursor";
const MAX_QUERIES_PER_RUN = 10;

export async function runPublicWebScout(env: {
  META_PRIVATE: KVNamespace;
  SOCIAL_SCOUT_SEARCH_API_KEY?: string;
  SOCIAL_SCOUT_SEARCH_ENGINE_ID?: string;
}, dailyCap = 20): Promise<PublicScoutRunResult> {
  const apiKey = env.SOCIAL_SCOUT_SEARCH_API_KEY;
  const engineId = env.SOCIAL_SCOUT_SEARCH_ENGINE_ID;
  if (!apiKey || !engineId) {
    return {
      configured: false,
      reason: "SOCIAL_SCOUT_SEARCH_API_KEY / SOCIAL_SCOUT_SEARCH_ENGINE_ID tanımlı değil (Google Programmable Search Engine). Public web scout hiçbir dış istek yapmadan durdu.",
    };
  }

  const rawCursor = await env.META_PRIVATE.get(CURSOR_KV_KEY).catch(() => null);
  const cursorIndex = Number.parseInt(rawCursor ?? "0", 10) || 0;
  const { queries, nextCursor } = buildScoutQueries(cursorIndex, MAX_QUERIES_PER_RUN);

  let candidatesFound = 0;
  let inserted = 0;
  let errors = 0;

  for (const query of queries) {
    if (inserted >= dailyCap) break;
    try {
      const items = await searchGoogle(apiKey, engineId, query.q);
      const candidates = parseSearchResultsToCandidates(items, query.category, query.location);
      candidatesFound += candidates.length;
      for (const candidate of candidates) {
        if (inserted >= dailyCap) break;
        const now = new Date().toISOString();
        const bioSummary = candidate.shortReason || null;
        const scores = computeScores({
          category: candidate.category, username: candidate.username,
          bioSummary, locationHint: candidate.locationHint, sourceUrl: candidate.sourceUrl,
        });
        await upsertProspect({
          villa: null,
          platform: "Instagram",
          username: candidate.username,
          accountId: null,
          displayName: null,
          category: candidate.category,
          bioSummary,
          followersCount: null,
          mediaCount: null,
          locationHint: candidate.locationHint,
          relevanceScore: scores.relevanceScore,
          engagementScore: null,
          locationScore: scores.locationScore,
          audienceFitScore: scores.audienceFitScore,
          spamRiskScore: scores.spamRiskScore,
          finalGrowthScore: scores.finalGrowthScore,
          discoveredAt: now,
          lastCheckedAt: now,
          sourceType: "public_web_search",
          sourceUrl: candidate.sourceUrl,
          shortReason: candidate.shortReason || null,
          profileUrl: candidate.profileUrl,
        });
        inserted += 1;
      }
    } catch {
      errors += 1;
    }
  }

  await env.META_PRIVATE.put(CURSOR_KV_KEY, String(nextCursor)).catch(() => undefined);
  return { configured: true, queriesRun: queries.length, candidatesFound, inserted, errors };
}
