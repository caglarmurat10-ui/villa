import { getCommissionRate, listPriceRanges, listReservations } from "@/lib/db";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [initialReservations, initialCommission, initialPrices] = await Promise.all([
    listReservations(),
    getCommissionRate(),
    listPriceRanges(),
  ]);
  return <Dashboard initialReservations={initialReservations} initialCommission={initialCommission} initialPrices={initialPrices} />;
}
