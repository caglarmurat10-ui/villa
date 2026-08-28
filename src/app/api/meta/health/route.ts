import { getFacebookPageProfile } from "@/lib/facebook";
import { getInstagramProfile, getInstagramPublishingLimit } from "@/lib/meta";
import { getFacebookCredentials, getInstagramCredentials } from "@/lib/meta-store";
import { brandProfiles } from "@/lib/brand-profiles";
import type { Villa } from "@/lib/types";

const villas: Villa[] = ["Safira", "Destan"];

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = await Promise.all(villas.flatMap((villa) => [
    (async () => {
      try {
        const account = await getInstagramCredentials(villa);
        if (!account) return { villa, platform: "Instagram" as const, connected: false, healthy: false, label: "Bağlı değil" };
        const [profile, quota] = await Promise.all([
          getInstagramProfile(account.accessToken),
          getInstagramPublishingLimit(account.accountId, account.accessToken),
        ]);
        const healthy = profile.id === account.accountId;
        return {
          villa,
          platform: "Instagram" as const,
          connected: true,
          healthy,
          label: healthy ? `@${profile.username} · API kotası ${quota.remaining}/${quota.quotaTotal}` : "Hesap kimliği değişmiş",
          quota,
        };
      } catch {
        return { villa, platform: "Instagram" as const, connected: true, healthy: false, label: "Yeniden bağlanmalı" };
      }
    })(),
    (async () => {
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
      } catch {
        return { villa, platform: "Facebook" as const, connected: true, healthy: false, label: "Yeniden bağlanmalı" };
      }
    })(),
  ]));

  return Response.json({
    checkedAt: new Date().toISOString(),
    healthy: checks.filter((item) => item.connected).every((item) => item.healthy),
    checks,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
