import { notFound } from "next/navigation";
import OperationsModuleView, { type OperationsModule } from "@/components/OperationsModuleView";
import { getCommissionRate, getVillaLocations, listPriceRanges, listReservations } from "@/lib/db";

export const dynamic = "force-dynamic";

const allowed = new Set<OperationsModule>(["rezervasyonlar", "villalar", "misafirler", "gorevler", "temizlik", "bakim", "finans", "raporlar", "ayarlar"]);

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!allowed.has(module as OperationsModule)) notFound();
  const [reservations, prices, locations, commission] = await Promise.all([
    listReservations(), listPriceRanges(), getVillaLocations(), getCommissionRate(),
  ]);
  return <OperationsModuleView module={module as OperationsModule} reservations={reservations} prices={prices} locations={locations} commission={commission} />;
}
