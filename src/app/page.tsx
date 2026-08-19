import { getCommissionRate, getVillaLocations, listPriceRanges, listReservations } from "@/lib/db";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [initialReservations, initialCommission, initialPrices, initialLocations] = await Promise.all([
    listReservations(),
    getCommissionRate(),
    listPriceRanges(),
    getVillaLocations(),
  ]);
  return <Dashboard initialReservations={initialReservations} initialCommission={initialCommission} initialPrices={initialPrices} initialLocations={initialLocations} />;
}
