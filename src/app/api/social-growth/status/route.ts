import { GROWTH_CAPABILITIES, growthCapabilitiesSummary } from "@/lib/social-growth-capabilities";
import { listAgentRuns } from "@/lib/social-growth-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [runs, summary] = await Promise.all([
    listAgentRuns(6),
    Promise.resolve(growthCapabilitiesSummary()),
  ]);
  return Response.json({
    capabilities: GROWTH_CAPABILITIES,
    summary,
    recentRuns: runs,
  }, { headers: { "Cache-Control": "no-store" } });
}
