"use client";

import dynamic from "next/dynamic";
import type { SocialPost } from "@/lib/types";
import type { AvailabilityGap } from "@/lib/social-availability";

const SocialContentLibrary = dynamic(() => import("@/components/SocialContentLibrary"), {
  ssr: false,
  loading: () => <div style={{maxWidth:1250,margin:"14px auto",padding:"16px 20px",color:"#94a3b8"}}>İçerik kütüphanesi yükleniyor…</div>,
});

const SocialMediaView = dynamic(() => import("@/components/SocialMediaView"), {
  ssr: false,
  loading: () => <div style={{maxWidth:1250,margin:"14px auto",padding:"16px 20px",color:"#94a3b8"}}>Sosyal takvim yükleniyor…</div>,
});

export default function SocialDeferredContent({ posts, gaps }: { posts: SocialPost[]; gaps: AvailabilityGap[] }) {
  return <>
    <SocialContentLibrary />
    <SocialMediaView initialPosts={posts} availabilityGaps={gaps} />
  </>;
}
