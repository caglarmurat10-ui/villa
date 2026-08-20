import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LocationRedirect from "@/components/LocationRedirect";
import { getVillaLocations } from "@/lib/db";

type VillaSlug = "safira" | "destan";

const villaData: Record<VillaSlug, { name: string; key: "Safira" | "Destan"; image: string }> = {
  safira: {
    name: "Villa Safira",
    key: "Safira",
    image: "https://www.villapatara.com.tr/uploads/villa-safira-14_743.jpg",
  },
  destan: {
    name: "Villa Destan",
    key: "Destan",
    image: "https://www.villavakti.com/thumbs/1200/630/catalog/3318/batch_villa-destan_45-7604.jpg",
  },
};

function resolveVilla(value: string) {
  const slug = value.toLocaleLowerCase("tr-TR") as VillaSlug;
  return villaData[slug] ? { slug, ...villaData[slug] } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ villa: string }> }): Promise<Metadata> {
  const { villa } = await params;
  const current = resolveVilla(villa);
  if (!current) return {};
  const title = `${current.name} Konum`;
  const description = `${current.name} • Patara, Kaş / Antalya konum bilgisi`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "tr_TR",
      images: [{ url: current.image, width: 1200, height: 630, alt: current.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [current.image],
    },
  };
}

export const dynamic = "force-dynamic";

export default async function LocationPage({ params }: { params: Promise<{ villa: string }> }) {
  const { villa } = await params;
  const current = resolveVilla(villa);
  if (!current) notFound();
  const locations = await getVillaLocations();
  const href = locations[current.key];
  if (!href) notFound();
  return <LocationRedirect href={href} villaName={current.name} />;
}
