import MessageCenter from "@/components/MessageCenter";
import { getVillaLocations, listReservations } from "@/lib/db";

export const dynamic = "force-dynamic";

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export default async function MessagesPage() {
  const [reservations, locations] = await Promise.all([listReservations(), getVillaLocations()]);
  const today = istanbulToday();
  return <MessageCenter reservations={reservations.filter((r) => r.checkOut >= today)} locations={locations} />;
}
