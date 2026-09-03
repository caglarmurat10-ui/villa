import { discoverGbpAccountsAndLocations } from "@/lib/gbp/adapter";
import { getAllGbpLocationMappings } from "@/lib/gbp/mapping";

export const dynamic = "force-dynamic";

// admin.safiradestan.com'da adminAuthGate tarafından korunuyor, diğer /api/admin/* route'ları
// gibi hiçbir public allowlist'e eklenmedi. Salt-okunur: hiçbir GBP mutation'ı yapmaz.
export async function GET() {
  const [discovery, mappings] = await Promise.all([
    discoverGbpAccountsAndLocations(),
    getAllGbpLocationMappings(),
  ]);
  return Response.json({ discovery, mappings });
}
