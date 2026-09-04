import type { Metadata } from "next";
import VillaDetailPage from "../[slug]/page";
import { getPublicVillaMetadata } from "@/lib/public-villa-seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = getPublicVillaMetadata("villa-destan");

export default function VillaDestanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <VillaDetailPage params={Promise.resolve({ slug: "villa-destan" })} searchParams={searchParams} />;
}
