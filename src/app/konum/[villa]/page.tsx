import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LocationRedirect from "@/components/LocationRedirect";
import { getVillaLocations } from "@/lib/db";

type VillaSlug = "safira" | "destan";

const villaData: Record<VillaSlug, { name: string; key: "Safira" | "Destan" }> = {
  safira: { name: "Villa Safira", key: "Safira" },
  destan: { name: "Villa Destan", key: "Destan" },
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
    openGraph: { title, description, type: "website", locale: "tr_TR" },
    twitter: { card: "summary", title, description },
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
