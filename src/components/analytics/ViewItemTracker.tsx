"use client";

import { useEffect } from "react";
import { trackViewItem, type VillaId } from "@/lib/analytics";

// Villa detay sayfası render/navigate edildiğinde bir kez view_item gönderir. App Router her yeni
// [slug] navigasyonunda bu bileşeni yeniden mount ettiği için effect yalnızca bir kez, gerçek bir
// sayfa değişiminde çalışır - duplicate tetikleme olmaz.
export default function ViewItemTracker({ villaId, villaName }: { villaId: VillaId; villaName: string }) {
  useEffect(() => {
    trackViewItem({ villa_id: villaId, villa_name: villaName });
  }, [villaId, villaName]);

  return null;
}
