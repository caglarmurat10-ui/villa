import MetaConnections from "@/components/MetaConnections";
import SocialContentLibrary from "@/components/SocialContentLibrary";
import SocialMediaView from "@/components/SocialMediaView";
import { listMetaAccounts } from "@/lib/meta-store";
import { listReservations } from "@/lib/db";
import { findAvailabilityGaps } from "@/lib/social-availability";
import { listSocialPosts } from "@/lib/social-db";

export const dynamic = "force-dynamic";

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export default async function SocialPage() {
  const [posts, accounts, reservations] = await Promise.all([listSocialPosts(), listMetaAccounts(), listReservations()]);
  const gaps = findAvailabilityGaps(reservations, istanbulToday());
  return <><MetaConnections initialAccounts={accounts} /><SocialContentLibrary /><SocialMediaView initialPosts={posts} availabilityGaps={gaps} /></>;
}
