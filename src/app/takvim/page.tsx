import VillaCalendarWorkspace from "@/components/VillaCalendarWorkspace";
import { getVillaLocations, listReservations } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TakvimPage() {
  const [reservations, locations] = await Promise.all([listReservations(), getVillaLocations()]);
  return <VillaCalendarWorkspace reservations={reservations} locations={locations} />;
}
