import { getCloudflareContext } from "@opennextjs/cloudflare";
import { runPublicWebScout } from "@/lib/social-growth-public-scout";
import { recordAgentRun } from "@/lib/social-growth-store";

export const dynamic = "force-dynamic";

// Günlük cron (custom-worker.mjs runPublicScoutIfDue) tarafından in-process çağrılır. Hiçbir
// Meta API'sine dokunmaz; SOCIAL_SCOUT_SEARCH_API_KEY tanımlı değilse hiçbir dış istek atmadan
// PENDING_CONFIGURATION olarak kaydeder (bkz. social-growth-public-scout.ts).
export async function POST() {
  const { env } = await getCloudflareContext({ async: true });
  const result = await runPublicWebScout(env, 20);

  if (!result.configured) {
    const run = await recordAgentRun({ agentType: "SCOUT", status: "PENDING_CONFIGURATION", candidateCount: 0, notes: result.reason });
    return Response.json({ result, run });
  }

  const status = result.inserted === 0 && result.errors > 0 && result.queriesRun === result.errors ? "ERROR" : "OK";
  const run = await recordAgentRun({
    agentType: "SCOUT",
    status,
    candidateCount: result.inserted,
    notes: `${result.queriesRun} sorgu, ${result.candidatesFound} aday bulundu, ${result.inserted} eklendi, ${result.errors} hata.`,
  });
  return Response.json({ result, run });
}
