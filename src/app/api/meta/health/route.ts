import { getFacebookPageProfile } from "@/lib/facebook";
import { getInstagramProfile, getInstagramPublishingLimit } from "@/lib/meta";
import { getFacebookCredentials, getInstagramCredentials, listMetaAccounts } from "@/lib/meta-store";
import { brandProfiles } from "@/lib/brand-profiles";
import { DESTAN_INSTAGRAM_HARD_BLOCK, isMetaTargetHardBlocked } from "@/lib/social-account-policy";
import type { Villa } from "@/lib/types";

const villas: Villa[] = ["Safira", "Destan"];
const FACEBOOK_GRAPH = "https://graph.facebook.com/v26.0";

export const dynamic = "force-dynamic";

type HealthFailureReason = "configuration" | "expired-token" | "credentials" | "meta-api";
type RelationshipStatus = "healthy" | "mismatch" | "missing" | "unavailable";

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

async function relationshipForVilla(villa: Villa) {
  try {
    const [facebook, instagram] = await Promise.all([
      getFacebookCredentials(villa),
      getInstagramCredentials(villa),
    ]);

    if (!facebook || !instagram) {
      return {
        villa,
        status: "missing" as RelationshipStatus,
        healthy: false,
        label: !facebook && !instagram
          ? "Facebook ve Instagram bağlantısı eksik"
          : !facebook
            ? "Facebook Sayfası bağlantısı eksik"
            : "Instagram bağlantısı eksik",
      };
    }

    const relation = await getFacebookInstagramRelationship(facebook.accountId, facebook.accessToken);
    const linked = [
      relation.instagram_business_account,
      relation.connected_instagram_account,
    ].filter((item): item is { id?: string; username?: string } => Boolean(item?.id));

    if (!linked.length) {
      return {
        villa,
        status: "missing" as RelationshipStatus,
        healthy: false,
        label: `${relation.name ?? `Villa ${villa}`} Facebook Sayfasında bağlı Instagram profesyonel hesabı görünmüyor`,
      };
    }

    const exact = linked.find((item) => item.id === instagram.accountId);
    if (!exact) {
      const visibleName = linked.find((item) => item.username)?.username;
      return {
        villa,
        status: "mismatch" as RelationshipStatus,
        healthy: false,
        label: visibleName
          ? `Facebook Sayfası @${visibleName} hesabına bağlı; Villa ${villa} için kaydettiğimiz Instagram hesabıyla eşleşmiyor`
          : `Facebook Sayfasına bağlı Instagram hesabı Villa ${villa} için kaydettiğimiz hesapla eşleşmiyor`,
      };
    }

    return {
      villa,
      status: "healthy" as RelationshipStatus,
      healthy: true,
      label: `Facebook ↔ Instagram eşleşmesi doğru${exact.username ? ` · @${exact.username}` : ""}`,
    };
  } catch {
    return {
      villa,
      status: "unavailable" as RelationshipStatus,
      healthy: null,
      label: "Meta içindeki Facebook–Instagram eşleşmesi API ile şu an okunamadı; hesap bağlantıları ayrı ayrı test edilmeye devam ediyor",
    };
  }
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
    Promise.all(villas.map(relationshipForVilla)),
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
