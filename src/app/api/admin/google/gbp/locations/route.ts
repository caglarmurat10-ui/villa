import { discoverGbpAccountsAndLocations } from "@/lib/gbp/adapter";
import { getAllGbpLocationMappings } from "@/lib/gbp/mapping";

export const dynamic = "force-dynamic";

// admin.safiradestan.com'da adminAuthGate tarafından korunuyor. mappingsOnly=1 yalnız bizim
// GOOGLE_PRIVATE KV eşlememizi okur ve Google GBP API'sine hiç istek atmaz. Gerçek account/location
// keşfi yalnız admin'in açık "Keşfet" aksiyonunda çalışır; böylece sayfa refresh'leri 429 üretmez.
export async function GET(request: Request) {
  const mappings = await getAllGbpLocationMappings();
  const url = new URL(request.url);
  if (url.searchParams.get("mappingsOnly") === "1") {
    return Response.json({ mappings });
  }

  const discovery = await discoverGbpAccountsAndLocations();
  return Response.json({ discovery, mappings });
}
