import { listProspects } from "@/lib/social-growth-store";
import type { Villa } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseVilla(value: string | null): Villa | null {
  return value === "Safira" || value === "Destan" ? value : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const villa = parseVilla(url.searchParams.get("villa"));
  const prospects = await listProspects(villa);
  return Response.json({ prospects }, { headers: { "Cache-Control": "no-store" } });
}
