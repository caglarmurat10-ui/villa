import MessageCenter from "@/components/MessageCenter";
import { getVillaLocations, listReservations } from "@/lib/db";
import { listLatestCheckoutRemindersForReservations } from "@/lib/whatsapp/store";

export const dynamic = "force-dynamic";

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export default async function MessagesPage() {
  const [reservations, locations] = await Promise.all([listReservations(), getVillaLocations()]);
  const today = istanbulToday();
  const activeReservations = reservations.filter((r) => r.checkOut >= today);
  const reminderMap = await listLatestCheckoutRemindersForReservations(activeReservations.map((r) => r.id));
  const checkoutReminders = Object.fromEntries(reminderMap);
  return <MessageCenter reservations={activeReservations} locations={locations} checkoutReminders={checkoutReminders} />;
}
