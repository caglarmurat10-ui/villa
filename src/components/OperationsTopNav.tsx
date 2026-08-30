"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/", "Genel Bakış", "⌂"],
  ["/rezervasyonlar", "Rezervasyonlar", "▤"],
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
  return <div className="ops-nav-wrap">
    <div className="ops-nav-brand"><strong>Villa Yönetim</strong><span>Operasyon Merkezi</span></div>
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
