"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const items = [
  ["/", "Genel Bakış", "⌂"],
  ["/rezervasyonlar", "Rezervasyonlar", "▤"],
  ["/talepler", "Talepler", "◈"],
  ["/takvim", "Takvim", "▦"],
  ["/villalar", "Villalar", "⌂"],
  ["/misafirler", "Misafirler", "◎"],
  ["/gorevler", "Görevler", "✓"],
  ["/mesajlar", "Mesajlar", "✉"],
  ["/temizlik", "Temizlik", "✦"],
  ["/bakim", "Bakım", "⚒"],
  ["/finans", "Finans", "₺"],
  ["/hesaplama", "Hesaplama", "∑"],
  ["/raporlar", "Raporlar", "▥"],
  ["/sosyal", "Sosyal Medya", "◉"],
  ["/ayarlar", "Ayarlar", "⚙"],
] as const;

export default function OperationsTopNav() {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  if (pathname === "/login") return null;

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Çıkış yapılamadı.");
      window.location.replace("/login");
    } catch {
      setLoggingOut(false);
      window.alert("Çıkış yapılamadı. Lütfen tekrar deneyin.");
    }
  }

  return <div className="ops-nav-wrap">
    <div className="ops-nav-brand">
      <strong>Villa Yönetim</strong>
      <span>Operasyon Merkezi</span>
      <button className="ops-logout" type="button" disabled={loggingOut} onClick={() => void logout()}>
        {loggingOut ? "Çıkılıyor…" : "Çıkış"}
      </button>
    </div>
    <nav className="ops-top-nav" aria-label="Villa Yönetim ana modülleri">
      {items.map(([href, label, icon]) => {
        const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
          <i aria-hidden="true">{icon}</i><span>{label}</span>
        </Link>;
      })}
    </nav>
  </div>;
}
