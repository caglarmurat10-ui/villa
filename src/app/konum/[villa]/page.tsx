import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LocationRedirect from "@/components/LocationRedirect";
import { getVillaLocations } from "@/lib/db";
import { villaProfileFromSlug } from "@/lib/villaProfiles";

export async function generateMetadata({ params }: { params: Promise<{ villa: string }> }): Promise<Metadata> {
  const { villa } = await params;
  const current = villaProfileFromSlug(villa);
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
      images: [{ url: current.sourceImageUrl, width: 1200, height: 630, alt: current.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [current.sourceImageUrl],
    },
  };
}

export const dynamic = "force-dynamic";

export default async function LocationPage({ params }: { params: Promise<{ villa: string }> }) {
  const { villa } = await params;
  const current = villaProfileFromSlug(villa);
  if (!current) notFound();
  const locations = await getVillaLocations();
  const href = locations[current.villa];
  if (!href) notFound();
  return <LocationRedirect href={href} villaName={current.name} />;
}
