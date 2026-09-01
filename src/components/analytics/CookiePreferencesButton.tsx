"use client";

import { openCookiePreferences } from "@/lib/analytics";

// Footer'da "Çerez Tercihleri" - kapatılmış banner'ı tekrar açan tek satırlık aksiyon.
export default function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={openCookiePreferences}>
      Çerez Tercihleri
    </button>
  );
}
