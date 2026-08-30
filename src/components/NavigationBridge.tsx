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

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (button?.textContent?.trim() === "Mesaj paneli") {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign("/mesajlar");
      }
    };
    document.addEventListener("click", handleClick, true);

    return () => {
      window.open = originalOpen;
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  // Eski Dashboard'dan kalan tek görünür köprü olan "Mesaj paneli" yeni /mesajlar sayfasına gider.
  // WhatsApp açılışında da yalnız eski giriş cümlesi kalmışsa son metinle eşitlenir.
  return null;
}
