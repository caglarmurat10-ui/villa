import SocialMediaView from "@/components/SocialMediaView";
import { listSocialPosts } from "@/lib/social-db";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  return <SocialMediaView initialPosts={await listSocialPosts()} />;
}
