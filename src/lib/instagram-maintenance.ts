import { refreshInstagramLongLivedToken } from "./meta";
import { getInstagramCredentials, saveInstagramAccount, type MetaSocialAccount } from "./meta-store";
import type { Villa } from "./types";

const MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000;

export type InstagramMaintenanceResult = {
  villa: Villa;
  status: "missing" | "tracked" | "refreshed" | "too-new" | "failed";
};

export async function maintainInstagramConnection(villa: Villa): Promise<InstagramMaintenanceResult> {
  try {
    const account = await getInstagramCredentials(villa);
    if (!account) return { villa, status: "missing" };
    if (account.tokenExpiresAt) return { villa, status: "tracked" };

    const connectedAt = Date.parse(account.connectedAt);
    if (Number.isFinite(connectedAt) && Date.now() - connectedAt < MIN_REFRESH_AGE_MS) {
      return { villa, status: "too-new" };
    }

    const refreshed = await refreshInstagramLongLivedToken(account.accessToken);
    await saveInstagramAccount(
      villa,
      account.accountId,
      account.username,
      refreshed.accessToken,
      refreshed.expiresIn,
    );
    return { villa, status: "refreshed" };
  } catch (error) {
    const safe = (error instanceof Error ? error.message : "Instagram bakım işlemi başarısız.")
      .replace(/(access_token|client_secret|code)=([^&\s]+)/gi, "$1=[REDACTED]")
      .replace(/[A-Za-z0-9._~-]{80,}/g, "[REDACTED]")
      .slice(0, 240);
    console.error(`[Instagram Maintenance][${villa}] ${safe}`);
    return { villa, status: "failed" };
  }
}

export async function maintainLegacyInstagramConnections(accounts: MetaSocialAccount[]) {
  const legacy = accounts.filter((item) => item.platform === "Instagram" && !item.tokenExpiresAt);
  if (legacy.length === 0) return { refreshed: false, results: [] as InstagramMaintenanceResult[] };
  const results = await Promise.all(legacy.map((item) => maintainInstagramConnection(item.villa)));
  return { refreshed: results.some((item) => item.status === "refreshed"), results };
}
