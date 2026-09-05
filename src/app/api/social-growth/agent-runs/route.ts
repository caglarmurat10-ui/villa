import { listAgentRuns } from "@/lib/social-growth-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const runs = await listAgentRuns(30);
  return Response.json({ runs }, { headers: { "Cache-Control": "no-store" } });
}
