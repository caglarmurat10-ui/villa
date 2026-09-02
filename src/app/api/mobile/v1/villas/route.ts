import { VILLAS, formatAddress } from "@/lib/villa-content";
import { getVillaLocations } from "@/lib/db";
import { whatsappLink } from "@/lib/contact";

export const dynamic = "force-dynamic";

// Yalnız villa-content.ts'teki gerçek/doğrulanmış veri - hiçbir alan tahmin edilmiyor.
export async function GET() {
  const locations = await getVillaLocations();
  const villas = Object.values(VILLAS).map((villa) => ({
    slug: villa.slug,
    villa: villa.villa,
    name: villa.name,
    address: formatAddress(villa.address),
    coverImage: villa.cover,
    website: `https://safiradestan.com/${villa.slug}`,
    mapsUrl: locations[villa.villa] || null,
    instagram: villa.instagram,
    facebook: villa.facebook,
    whatsappUrl: whatsappLink(villa.whatsappMessage),
    quickFacts: villa.quickFacts,
    highlights: villa.highlights,
  }));
  return Response.json({ villas });
}
