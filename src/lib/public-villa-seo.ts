import type { Metadata } from "next";
import { VILLAS, type VillaSlug } from "./villa-content";

const ORIGIN = "https://safiradestan.com";

export function getPublicVillaMetadata(slug: VillaSlug): Metadata {
  const villa = VILLAS[slug];
  const canonical = `${ORIGIN}/${slug}`;
  const title = `${villa.name} Resmi Site | Patara Kaş Özel Havuzlu Villa`;
  const description = `${villa.name}, Patara Kaş'ta özel havuzlu villa. Gerçek fotoğrafları görün, canlı müsaitliği ve dönemsel fiyatı kontrol edin, doğrudan talep gönderin.`;

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
