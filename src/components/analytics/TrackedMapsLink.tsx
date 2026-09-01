"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackMapsClick, type VillaId } from "@/lib/analytics";

// Sunucu bileşenlerinde render edilen Maps/Yol Tarifi linkleri için ince istemci sarmalayıcı.
// Server Component'lerden Client Component'lere fonksiyon prop GEÇİRİLEMEDİĞİ için (RSC sınırı) bu
// bileşen yalnızca serileştirilebilir veri prop'ları alır, event çağrısını kendi içinde yapar.
interface TrackedMapsLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  villaId?: VillaId;
  villaName?: string;
  ctaLocation: string;
  mapAction: "open_maps" | "directions";
}

export default function TrackedMapsLink({ villaId, villaName, ctaLocation, mapAction, onClick, ...rest }: TrackedMapsLinkProps) {
  return (
    <a
      {...rest}
      onClick={(event) => {
        trackMapsClick({ villa_id: villaId, villa_name: villaName, cta_location: ctaLocation, map_action: mapAction });
        onClick?.(event);
      }}
    />
  );
}
