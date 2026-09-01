"use client";

import type { AnchorHTMLAttributes } from "react";
import { trackOtaBookingClick, type OtaBookingChannel, type VillaId } from "@/lib/analytics";

// Sunucu bileşenlerinde render edilen Airbnb/Booking rezervasyon linkleri için ince istemci
// sarmalayıcı - fonksiyon prop RSC sınırını geçemediği için yalnız serileştirilebilir veri alır,
// event çağrısını kendi içinde yapar. Tıklama bizim sistemde HİÇBİR rezervasyon/blok oluşturmaz -
// yalnız analytics event'i gönderir, link normal şekilde yeni sekmede açılır.
interface TrackedOtaLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  channel: OtaBookingChannel;
  villaId: VillaId;
  villaName: string;
  ctaLocation: string;
}

export default function TrackedOtaLink({ channel, villaId, villaName, ctaLocation, onClick, ...rest }: TrackedOtaLinkProps) {
  return (
    <a
      {...rest}
      onClick={(event) => {
        trackOtaBookingClick(channel, { villa_id: villaId, villa_name: villaName }, ctaLocation);
        onClick?.(event);
      }}
    />
  );
}
