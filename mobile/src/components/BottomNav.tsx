import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Ana Sayfa", icon: "🏠", end: true },
  { to: "/rezervasyonlar", label: "Rezervasyonlar", icon: "📋" },
  { to: "/takvim", label: "Takvim", icon: "📅" },
  { to: "/mesajlar", label: "Mesajlar", icon: "💬" },
  { to: "/daha-fazla", label: "Daha Fazla", icon: "⋯" },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
        >
          <span className="icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
