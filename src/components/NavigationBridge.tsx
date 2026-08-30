"use client";

import { useEffect } from "react";

const obsoleteArrivalLine = "Varış saatinizi müsait olduğunuzda bizimle paylaşabilirsiniz.\n\n";

export default function NavigationBridge() {
  useEffect(() => {
    const originalOpen = window.open.bind(window);

    window.open = ((url?: string | URL, target?: string, features?: string) => {
      if (typeof url === "string" && url.startsWith("https://wa.me/")) {
        try {
          const nextUrl = new URL(url);
          const text = nextUrl.searchParams.get("text");
          if (text?.includes(obsoleteArrivalLine)) {
            nextUrl.searchParams.set("text", text.replace(obsoleteArrivalLine, ""));
            return originalOpen(nextUrl.toString(), target, features);
          }
        } catch {
          // Geçersiz bir URL olursa mevcut davranışı aynen koru.
        }
      }
      return originalOpen(url, target, features);
    }) as typeof window.open;

    return () => {
      window.open = originalOpen;
    };
  }, []);

  // Mesajlar, giriş ve çıkış aksiyonları Dashboard içindeki özgün davranışını kullanır.
  // Bu köprü yalnızca eski giriş cümlesi kaldıysa WhatsApp mesajını son metinle eşitler.
  return null;
}
