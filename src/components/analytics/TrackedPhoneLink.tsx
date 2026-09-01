"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackPhoneClick, type VillaId } from "@/lib/analytics";

interface TrackedPhoneLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  villaId?: VillaId;
  ctaLocation: string;
}

export default function TrackedPhoneLink({ villaId, ctaLocation, onClick, ...rest }: TrackedPhoneLinkProps) {
  return (
    <a
      {...rest}
      onClick={(event) => {
        trackPhoneClick({ villa_id: villaId, cta_location: ctaLocation });
        onClick?.(event);
      }}
    />
  );
}
