import MetaConnections from "@/components/MetaConnections";
import MetaDiagnostics from "@/components/MetaDiagnostics";
import SocialContentLibrary from "@/components/SocialContentLibrary";
import SocialMediaView from "@/components/SocialMediaView";
import { listMetaAccounts } from "@/lib/meta-store";
import { getMetaDiagnostic } from "@/lib/meta-diagnostics";
import { listReservations } from "@/lib/db";
import { findAvailabilityGaps } from "@/lib/social-availability";
import { listSocialPosts } from "@/lib/social-db";

export const dynamic = "force-dynamic";

function istanbulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export default async function SocialPage() {
  const [posts, accounts, reservations] = await Promise.all([listSocialPosts(), listMetaAccounts(), listReservations()]);
  const [diagnostic] = await Promise.all([getMetaDiagnostic(accounts)]);
  const gaps = findAvailabilityGaps(reservations, istanbulToday());
  return <><MetaDiagnostics diagnostic={diagnostic} /><MetaConnections initialAccounts={accounts} /><SocialContentLibrary /><SocialMediaView initialPosts={posts} availabilityGaps={gaps} /></>;
}
