import type { Metadata } from "next";
import VillaDetailPage from "../[slug]/page";
import { getPublicVillaMetadata } from "@/lib/public-villa-seo";
import { VILLAS } from "@/lib/villa-content";

// 2026-09-10: İşletme sahibi tarafından paylaşılan güncel Villa Safira Airbnb ilanı.
// Paylaşım URL'sindeki guests/adults/s/unique_share_id izleme-parametreleri kalıcı site linkine
// taşınmıyor; yalnız kararlı ilan kimliği kullanılıyor. Generic villa sayfası aynı VILLAS nesnesini
// kullandığı için bu değer Airbnb CTA'sına ve schema.org sameAs alanına da yansır.
VILLAS["villa-safira"].airbnbListingUrl = "https://www.airbnb.com.tr/rooms/1767215275271349413";

export const dynamic = "force-dynamic";
export const metadata: Metadata = getPublicVillaMetadata("villa-safira");

export default function VillaSafiraPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <VillaDetailPage params={Promise.resolve({ slug: "villa-safira" })} searchParams={searchParams} />;
}
