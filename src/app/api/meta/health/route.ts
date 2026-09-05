import { getFacebookPageProfile, getFacebookTokenScopes } from "@/lib/facebook";
import { getInstagramProfile, getInstagramPublishingLimit } from "@/lib/meta";
import { getFacebookCredentials, getInstagramCredentials, listMetaAccounts } from "@/lib/meta-store";
import { brandProfiles } from "@/lib/brand-profiles";
import { DESTAN_INSTAGRAM_HARD_BLOCK, isMetaTargetHardBlocked } from "@/lib/social-account-policy";
import {
  FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION,
  classifyFacebookInstagramRelationship,
  legacyRelationshipStatus,
  type FacebookInstagramRelationResult,
  type FacebookTokenScopesResult,
} from "@/lib/facebook-instagram-relationship";
import type { Villa } from "@/lib/types";

const villas: Villa[] = ["Safira", "Destan"];
const FACEBOOK_GRAPH = "https://graph.facebook.com/v26.0";

export const dynamic = "force-dynamic";

type HealthFailureReason = "configuration" | "expired-token" | "credentials" | "meta-api";

function safeFailure(error: unknown, platform: "Instagram" | "Facebook") {
  const message = error instanceof Error ? error.message : "";
  if (/META_APP_SECRET|FACEBOOK_APP_SECRET|FACEBOOK_CONFIG_ID|META_PRIVATE|APP_BASE_URL|APP_ID/i.test(message)) {
    return {
      reason: "configuration" as HealthFailureReason,
      label: "Cloudflare Meta yapılandırması eksik",
    };
  }
  if (/süresi dolmuş|expired/i.test(message)) {
    return {
      reason: "expired-token" as HealthFailureReason,
      label: `${platform} erişim anahtarının süresi dolmuş; yeniden bağlayın`,
    };
  }
  if (/private KV|token|erişim anahtar|OAuth/i.test(message)) {
    return {
      reason: "credentials" as HealthFailureReason,
      label: `${platform} erişim anahtarı geçersiz veya eksik; yeniden bağlayın`,
    };
  }
  return {
    reason: "meta-api" as HealthFailureReason,
    label: `${platform} Meta API doğrulaması başarısız; yeniden bağlayın`,
  };
}

async function getFacebookCoreProfile(pageId: string, accessToken: string) {
  const url = new URL(`${FACEBOOK_GRAPH}/${encodeURIComponent(pageId)}`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { method: "GET" });
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    error?: { code?: number };
  };
  if (!response.ok || !payload.id) {
    throw new Error(`Facebook Sayfa kimliği doğrulanamadı (HTTP ${response.status}${payload.error?.code ? ` / ${payload.error.code}` : ""}).`);
  }
  return { id: payload.id, name: payload.name ?? "Facebook Sayfası" };
}

async function getFacebookInstagramRelationship(pageId: string, accessToken: string) {
  const url = new URL(`${FACEBOOK_GRAPH}/${encodeURIComponent(pageId)}`);
  url.searchParams.set("fields", "id,name,instagram_business_account{id,username},connected_instagram_account{id,username}");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { method: "GET" });
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    instagram_business_account?: { id?: string; username?: string } | null;
    connected_instagram_account?: { id?: string; username?: string } | null;
    error?: { code?: number };
  };
  if (!response.ok || !payload.id) {
    throw new Error(`Facebook–Instagram ilişki bilgisi okunamadı (HTTP ${response.status}${payload.error?.code ? ` / ${payload.error.code}` : ""}).`);
  }
  return payload;
}

async function relationshipCredentials(villa: Villa) {
  const [facebook, instagram] = await Promise.all([
    getFacebookCredentials(villa).catch(() => null),
    getInstagramCredentials(villa).catch(() => null),
  ]);
  return { villa, facebook, instagram };
}

async function relationshipScopeState(facebook: { accessToken: string } | null): Promise<FacebookTokenScopesResult> {
  if (!facebook) return { ok: false };
  try {
    const { scopes } = await getFacebookTokenScopes(facebook.accessToken);
    return { ok: true, scopes };
  } catch {
    return { ok: false };
  }
}

async function relationshipsForVillas() {
  const credentials = await Promise.all(villas.map(relationshipCredentials));
  const scopeStates = await Promise.all(credentials.map((item) => relationshipScopeState(item.facebook)));
  const scopeGrantedElsewhere = scopeStates.some(
    (state) => state.ok && state.scopes.includes(FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION),
  );

  return Promise.all(credentials.map(async ({ villa, facebook, instagram }, index) => {
    if (!facebook || !instagram) {
      const label = !facebook && !instagram
        ? "Facebook ve Instagram bağlantısı eksik"
        : !facebook
          ? "Facebook Sayfası bağlantısı eksik"
          : "Instagram bağlantısı eksik";
      return { villa, code: "FACEBOOK_IG_LINK_MISSING" as const, status: legacyRelationshipStatus("FACEBOOK_IG_LINK_MISSING"), healthy: false, label };
    }

    const scopesResult = scopeStates[index];
    let relationResult: FacebookInstagramRelationResult = { ok: false };
    let pageName = `Villa ${villa}`;
    if (scopesResult.ok && scopesResult.scopes.includes(FACEBOOK_INSTAGRAM_RELATIONSHIP_PERMISSION)) {
      try {
        const relation = await getFacebookInstagramRelationship(facebook.accountId, facebook.accessToken);
        pageName = relation.name ?? pageName;
        relationResult = {
          ok: true,
          pageName,
          instagramBusinessAccount: relation.instagram_business_account,
          connectedInstagramAccount: relation.connected_instagram_account,
        };
      } catch {
        relationResult = { ok: false };
      }
    }

    const classification = classifyFacebookInstagramRelationship({
      villa,
      pageName,
      storedInstagramAccountId: instagram.accountId,
      scopesResult,
      scopeGrantedElsewhere,
      relationResult,
    });

    return { villa, ...classification };
  }));
}

export async function GET() {
  const accounts = await listMetaAccounts();
  const connected = new Set(accounts.map((item) => `${item.villa}:${item.platform}`));

  const [checks, relationships] = await Promise.all([
    Promise.all(villas.flatMap((villa) => [
      ...(isMetaTargetHardBlocked(villa, "Instagram") ? [] : [(async () => {
        const isConnected = connected.has(`${villa}:Instagram`);
        if (!isConnected) return { villa, platform: "Instagram" as const, connected: false, healthy: false, label: "Bağlı değil" };
        try {
          const account = await getInstagramCredentials(villa);
          if (!account) return { villa, platform: "Instagram" as const, connected: false, healthy: false, label: "Bağlı değil" };

          const profile = await getInstagramProfile(account.accessToken);
          const healthy = profile.id === account.accountId;
          if (!healthy) {
            return {
              villa,
              platform: "Instagram" as const,
              connected: true,
              healthy: false,
              label: "Hesap kimliği değişmiş",
            };
          }

          try {
            const quota = await getInstagramPublishingLimit(account.accountId, account.accessToken);
            return {
              villa,
              platform: "Instagram" as const,
              connected: true,
              healthy: true,
              label: `@${profile.username} · API kotası ${quota.remaining}/${quota.quotaTotal}`,
              quota,
            };
          } catch {
            return {
              villa,
              platform: "Instagram" as const,
              connected: true,
              healthy: true,
              quotaAvailable: false,
              label: `@${profile.username} · API bağlantısı sağlıklı · kota şu an okunamadı`,
            };
          }
        } catch (error) {
          return { villa, platform: "Instagram" as const, connected: true, healthy: false, ...safeFailure(error, "Instagram") };
        }
      })()]),
      (async () => {
        const isConnected = connected.has(`${villa}:Facebook`);
        if (!isConnected) return { villa, platform: "Facebook" as const, connected: false, healthy: false, label: "Bağlı değil" };
        try {
          const account = await getFacebookCredentials(villa);
          if (!account) return { villa, platform: "Facebook" as const, connected: false, healthy: false, label: "Bağlı değil" };

          const coreProfile = await getFacebookCoreProfile(account.accountId, account.accessToken);
          if (coreProfile.id !== account.accountId) {
            return {
              villa,
              platform: "Facebook" as const,
              connected: true,
              healthy: false,
              label: "Sayfa kimliği değişmiş",
            };
          }

          try {
            const profile = await getFacebookPageProfile(account.accountId, account.accessToken);
            const brand = brandProfiles[villa].facebook;
            const brandAligned = profile.bio.trim() === brand.intro.trim() && profile.description.trim() === brand.about.trim();
            return {
              villa,
              platform: "Facebook" as const,
              connected: true,
              healthy: true,
              brandAligned,
              label: `${profile.name} · ${brandAligned ? "Hakkında güncel" : "Hakkında senkronu gerekli"}`,
            };
          } catch {
            return {
              villa,
              platform: "Facebook" as const,
              connected: true,
              healthy: true,
              brandAligned: null,
              brandDetailsAvailable: false,
              label: `${coreProfile.name} · API bağlantısı sağlıklı · Hakkında denetimi şu an kullanılamıyor`,
            };
          }
        } catch (error) {
          return { villa, platform: "Facebook" as const, connected: true, healthy: false, ...safeFailure(error, "Facebook") };
        }
      })(),
    ])),
    relationshipsForVillas(),
  ]);

  return Response.json({
    checkedAt: new Date().toISOString(),
    healthy: checks.every((item) => item.connected && item.healthy),
    relationshipsHealthy: relationships.every((item) => item.healthy === true),
    connectedCount: checks.filter((item) => item.connected).length,
    expectedCount: checks.length,
    blocked: DESTAN_INSTAGRAM_HARD_BLOCK.blocked ? [{
      villa: DESTAN_INSTAGRAM_HARD_BLOCK.villa,
      platform: DESTAN_INSTAGRAM_HARD_BLOCK.platform,
      label: DESTAN_INSTAGRAM_HARD_BLOCK.reason,
    }] : [],
    relationships,
    checks,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
