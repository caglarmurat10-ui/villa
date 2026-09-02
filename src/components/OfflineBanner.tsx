"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
function getSnapshot() {
  return navigator.onLine;
}
// Sunucuda navigator yok - her zaman "online" varsayılır, ilk client render'ı bununla eşleşir
// (useSyncExternalStore hydration mismatch'i bu şekilde engeller); gerçek durum mount sonrası
// senkronize olur.
function getServerSnapshot() {
  return true;
}

// Kritik mutation (rezervasyon/ödeme) için hiçbir offline queue YOK - yalnız durumu dürüstçe
// bildirir. navigator.onLine + online/offline event'leri; service worker gerekmez.
export default function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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
