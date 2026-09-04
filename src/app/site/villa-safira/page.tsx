import type { Metadata } from "next";
import VillaDetailPage from "../[slug]/page";
import { getPublicVillaMetadata } from "@/lib/public-villa-seo";

export const metadata: Metadata = getPublicVillaMetadata("villa-safira");

export default function VillaSafiraPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <VillaDetailPage params={Promise.resolve({ slug: "villa-safira" })} searchParams={searchParams} />;
}
