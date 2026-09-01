"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackGuidePlaceClick } from "@/lib/analytics";

// TrackedMapsLink/TrackedSocialLink ile aynı desen - sunucu bileşenindeki rehber-yeri linklerine
// ince istemci sarmalayıcı (RegionGuideGrid zaten kendi client component'i içinde bunu yapıyor;
// bu, sunucu-render edilen /rehber/[slug] sayfaları için aynı event'i kullanan eşdeğeri).
interface TrackedGuidePlaceLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  placeId: string;
  placeName: string;
  placeCategory: string;
}

export default function TrackedGuidePlaceLink({ placeId, placeName, placeCategory, onClick, ...rest }: TrackedGuidePlaceLinkProps) {
  return (
    <a
      {...rest}
      onClick={(event) => {
        trackGuidePlaceClick({ place_id: placeId, place_name: placeName, place_category: placeCategory });
        onClick?.(event);
      }}
    />
  );
}
