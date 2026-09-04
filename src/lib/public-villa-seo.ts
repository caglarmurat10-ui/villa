import type { Metadata } from "next";
import { VILLAS, type VillaSlug } from "./villa-content";

const ORIGIN = "https://safiradestan.com";

export function getPublicVillaMetadata(slug: VillaSlug): Metadata {
  const villa = VILLAS[slug];
  const canonical = `${ORIGIN}/${slug}`;
  const { maxGuests, bedroomCount } = villa.quickFacts;
  const title = `${villa.name} | Patara Kaş ${maxGuests} Kişilik Özel Havuzlu Villa`;
  const description = `${villa.name} resmi sitesi. Patara Kaş'ta ${maxGuests} kişilik, ${bedroomCount} yatak odalı özel havuzlu villa. Gerçek fotoğrafları görün, canlı müsaitliği kontrol edin ve doğrudan talep gönderin.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Safira & Destan Villas",
      locale: "tr_TR",
      type: "website",
      images: [{ url: villa.cover, alt: `${villa.name} Patara Kaş özel havuzlu villa` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [villa.cover],
    },
  };
}
