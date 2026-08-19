import MetaConnections from "@/components/MetaConnections";
import SocialMediaView from "@/components/SocialMediaView";
import { listMetaAccounts } from "@/lib/meta-store";
import { listSocialPosts } from "@/lib/social-db";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  const [posts, accounts] = await Promise.all([listSocialPosts(), listMetaAccounts()]);
  return <><MetaConnections initialAccounts={accounts} /><SocialMediaView initialPosts={posts} /></>;
}
