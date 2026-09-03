"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackDatesPriceClick, type VillaId } from "@/lib/analytics";

// Mobil sticky conversion bar'daki "Tarih & Fiyat" aksiyonu için ince istemci sarmalayıcı -
// TrackedMapsLink/TrackedWhatsappLink ile aynı desen (RSC sınırı: Server Component'ten Client
// Component'e fonksiyon prop geçirilemez, event çağrısı bileşenin kendi içinde yapılır).
interface TrackedDatesPriceLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  villaId?: VillaId;
  ctaLocation: string;
}

export default function TrackedDatesPriceLink({ villaId, ctaLocation, onClick, ...rest }: TrackedDatesPriceLinkProps) {
  return (
    <a
      {...rest}
      onClick={(event) => {
        trackDatesPriceClick({ villa_id: villaId, cta_location: ctaLocation });
        onClick?.(event);
      }}
    />
  );
}
