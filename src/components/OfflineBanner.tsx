"use client";

import { useEffect, useState } from "react";

// Kritik mutation (rezervasyon/ödeme) için hiçbir offline queue YOK - yalnız durumu dürüstçe
// bildirir. navigator.onLine + online/offline event'leri; service worker gerekmez.
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 90, background: "#3a2606", color: "#fde68a",
      fontSize: 11, fontWeight: 800, textAlign: "center", padding: "8px 12px",
    }}>
      Çevrimdışı — veri güncel olmayabilir.
    </div>
  );
}
