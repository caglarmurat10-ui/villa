import { getFacebookPageProfile } from "@/lib/facebook";
import { getInstagramProfile, getInstagramPublishingLimit } from "@/lib/meta";
import { getFacebookCredentials, getInstagramCredentials, listMetaAccounts } from "@/lib/meta-store";
import { brandProfiles } from "@/lib/brand-profiles";
import type { Villa } from "@/lib/types";

const villas: Villa[] = ["Safira", "Destan"];

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

export async function GET() {
  const accounts = await listMetaAccounts();
  const connected = new Set(accounts.map((item) => `${item.villa}:${item.platform}`));

  const checks = await Promise.all(villas.flatMap((villa) => [
    (async () => {
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
    })(),
    (async () => {
      const isConnected = connected.has(`${villa}:Facebook`);
      if (!isConnected) return { villa, platform: "Facebook" as const, connected: false, healthy: false, label: "Bağlı değil" };
      try {
        const account = await getFacebookCredentials(villa);
        if (!account) return { villa, platform: "Facebook" as const, connected: false, healthy: false, label: "Bağlı değil" };
        const profile = await getFacebookPageProfile(account.accountId, account.accessToken);
        const healthy = profile.id === account.accountId;
        const brand = brandProfiles[villa].facebook;
        const brandAligned = profile.bio.trim() === brand.intro.trim() && profile.description.trim() === brand.about.trim();
        return {
          villa,
          platform: "Facebook" as const,
          connected: true,
          healthy,
          brandAligned,
          label: healthy ? `${profile.name} · ${brandAligned ? "Hakkında güncel" : "Hakkında senkronu gerekli"}` : "Sayfa kimliği değişmiş",
        };
      } catch (error) {
        return { villa, platform: "Facebook" as const, connected: true, healthy: false, ...safeFailure(error, "Facebook") };
      }
    })(),
  ]));

  return Response.json({
    checkedAt: new Date().toISOString(),
    healthy: checks.every((item) => item.connected && item.healthy),
    connectedCount: checks.filter((item) => item.connected).length,
    expectedCount: checks.length,
    checks,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
