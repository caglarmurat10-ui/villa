import { getCloudflareContext } from "@opennextjs/cloudflare";
import { GROWTH_CAPABILITIES, growthCapabilitiesSummary } from "@/lib/social-growth-capabilities";
import { listAgentRuns } from "@/lib/social-growth-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  // Public Scout credentials are optional by design; expose only presence/missing names, never values.
  const scoutEnv = env as typeof env & {
    SOCIAL_SCOUT_SEARCH_API_KEY?: string;
    SOCIAL_SCOUT_SEARCH_ENGINE_ID?: string;
  };
  const [runs, summary] = await Promise.all([
    listAgentRuns(6),
    Promise.resolve(growthCapabilitiesSummary()),
  ]);
  const missingPublicScout = [
    !scoutEnv.SOCIAL_SCOUT_SEARCH_API_KEY ? "SOCIAL_SCOUT_SEARCH_API_KEY" : null,
    !scoutEnv.SOCIAL_SCOUT_SEARCH_ENGINE_ID ? "SOCIAL_SCOUT_SEARCH_ENGINE_ID" : null,
  ].filter((value): value is string => Boolean(value));
  return Response.json({
    capabilities: GROWTH_CAPABILITIES,
    summary,
    recentRuns: runs,
    publicScout: { configured: missingPublicScout.length === 0, missing: missingPublicScout },
  }, { headers: { "Cache-Control": "no-store" } });
}
