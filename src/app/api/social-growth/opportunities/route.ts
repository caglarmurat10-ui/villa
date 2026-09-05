import { listOpportunities } from "@/lib/social-growth-store";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseVilla(value: string | null): Villa | null {
  return value === "Safira" || value === "Destan" ? value : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const villa = parseVilla(url.searchParams.get("villa"));
  const opportunities = await listOpportunities(villa);
  return Response.json({ opportunities }, { headers: { "Cache-Control": "no-store" } });
}
