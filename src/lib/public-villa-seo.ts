import type { Metadata } from "next";
import { VILLAS, type VillaSlug } from "./villa-content";
import { hreflangAlternates } from "./seo";

const ORIGIN = "https://safiradestan.com";

// Gerçek dosya piksel boyutları (JPEG SOF header'ından okunarak doğrulandı, 2026-09-10) - hero
// görselleri villa başına FARKLI boyutlarda (kırpma/çekim farkı), bu yüzden tek bir sabit
// kullanılmaz. layout.tsx'teki ana sayfa OG görseliyle AYNI kaynak/disiplin.
const HERO_IMAGE_DIMENSIONS: Record<VillaSlug, { width: number; height: number }> = {
  "villa-safira": { width: 1400, height: 842 },
  "villa-destan": { width: 1400, height: 934 },
};

export function getPublicVillaMetadata(slug: VillaSlug): Metadata {
  const villa = VILLAS[slug];
  const canonical = `${ORIGIN}/${slug}`;
  const { maxGuests, bedroomCount } = villa.quickFacts;
  const title = `${villa.name} Patara | Resmi Site • Kaş Özel Havuzlu Villa`;
  const description = `${villa.name} resmi sitesi. Patara Kaş'ta ${maxGuests} kişilik, ${bedroomCount} yatak odalı özel havuzlu villa. Gerçek fotoğrafları görün, canlı müsaitliği kontrol edin.`;

  return {
    title,
    description,
    alternates: hreflangAlternates(canonical),
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Safira & Destan Villas",
      locale: "tr_TR",
      type: "website",
      images: [{ url: villa.cover, ...HERO_IMAGE_DIMENSIONS[slug], alt: `${villa.name} Patara Kaş özel havuzlu villa` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [villa.cover],
    },
  };
}
