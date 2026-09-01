"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackSocialProfileClick, type SocialPlatformAnalytics, type VillaId } from "@/lib/analytics";

// TrackedOtaLink ile aynı desen - sunucu bileşenindeki düz Instagram/Facebook linklerine ince
// istemci sarmalayıcı. Tıklama yalnız analytics event'i gönderir, link normal şekilde açılır.
interface TrackedSocialLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  platform: SocialPlatformAnalytics;
  villaId?: VillaId;
  ctaLocation: string;
}

export default function TrackedSocialLink({ platform, villaId, ctaLocation, onClick, ...rest }: TrackedSocialLinkProps) {
  return (
    <a
      {...rest}
      onClick={(event) => {
        trackSocialProfileClick(platform, { villa_id: villaId }, ctaLocation);
        onClick?.(event);
      }}
    />
  );
}
