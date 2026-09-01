import VillaCalendarWorkspace from "@/components/VillaCalendarWorkspace";
import { getVillaLocations, listReservations } from "@/lib/db";
import { listExternalBlocksForAdmin } from "@/lib/ota/availability";

export const dynamic = "force-dynamic";

export default async function TakvimPage() {
  const [reservations, locations, externalBlocks] = await Promise.all([listReservations(), getVillaLocations(), listExternalBlocksForAdmin()]);
  return <VillaCalendarWorkspace reservations={reservations} locations={locations} externalBlocks={externalBlocks} />;
}
