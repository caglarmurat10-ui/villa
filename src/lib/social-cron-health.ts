import { getCloudflareContext } from "@opennextjs/cloudflare";

// custom-worker.mjs'teki runSocialCron() her tikte (aday olsun olmasın) bu anahtara yazar - D1'e
// yalnız gerçek bir yayın DENEMESİ olduğunda satır düştüğü için (bkz. claimSocialPublishAttempt),
// "cron gerçekten çalışıyor mu" sorusunun D1 dışındaki tek dürüst kaynağı bu heartbeat'tir.
const KV_KEY = "social_cron_heartbeat";

export interface SocialCronHeartbeat {
  ranAt: string;
  enabled: boolean;
  candidateCount: number;
  successCount: number;
  skippedCount: number;
  errorCount: number;
  queryFailed?: boolean;
}

export async function getSocialCronHeartbeat(): Promise<SocialCronHeartbeat | null> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.META_PRIVATE) return null;
  const raw = await env.META_PRIVATE.get(KV_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SocialCronHeartbeat;
    if (typeof parsed.ranAt !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
