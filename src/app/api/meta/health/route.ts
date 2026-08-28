import { getFacebookPageProfile } from "@/lib/facebook";
import { getInstagramProfile } from "@/lib/meta";
import { getFacebookCredentials, getInstagramCredentials } from "@/lib/meta-store";
import type { Villa } from "@/lib/types";

const villas: Villa[] = ["Safira", "Destan"];

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = await Promise.all(villas.flatMap((villa) => [
    (async () => {
      try {
        const account = await getInstagramCredentials(villa);
        if (!account) return { villa, platform: "Instagram" as const, connected: false, healthy: false, label: "Bağlı değil" };
        const profile = await getInstagramProfile(account.accessToken);
        return {
          villa,
          platform: "Instagram" as const,
          connected: true,
          healthy: profile.id === account.accountId,
          label: profile.id === account.accountId ? `@${profile.username}` : "Hesap kimliği değişmiş",
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
        return {
          villa,
          platform: "Facebook" as const,
          connected: true,
          healthy: profile.id === account.accountId,
          label: profile.id === account.accountId ? profile.name : "Sayfa kimliği değişmiş",
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
