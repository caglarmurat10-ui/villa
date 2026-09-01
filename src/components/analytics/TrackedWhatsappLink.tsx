"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackWhatsappClick, type VillaId } from "@/lib/analytics";

// TrackedMapsLink/TrackedSocialLink ile aynı desen. villa_name PII DEĞİL (herkese açık villa adı,
// misafir bilgisi değil) - trackWhatsappClick zaten yalnız villa_id/villa_name/cta_location alır.
interface TrackedWhatsappLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  villaId?: VillaId;
  villaName?: string;
  ctaLocation: string;
}

export default function TrackedWhatsappLink({ villaId, villaName, ctaLocation, onClick, ...rest }: TrackedWhatsappLinkProps) {
  return (
    <a
      {...rest}
      onClick={(event) => {
        trackWhatsappClick({ villa_id: villaId, villa_name: villaName, cta_location: ctaLocation });
        onClick?.(event);
      }}
    />
  );
}
