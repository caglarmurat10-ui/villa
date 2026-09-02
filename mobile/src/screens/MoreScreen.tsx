import { Link } from "react-router-dom";
import { TopBar } from "../components/common";

const items = [
  { to: "/sosyal", label: "Sosyal Medya", icon: "📣" },
  { to: "/villalar", label: "Villalar", icon: "🏡" },
  { to: "/google-gorunurluk", label: "Google Görünürlük", icon: "🔍" },
  { to: "/ayarlar", label: "Ayarlar", icon: "⚙️" },
];

export function MoreScreen() {
  return (
    <div>
      <TopBar title="Daha Fazla" />
      <div className="app-content">
        {items.map((item) => (
          <Link className="list-item" to={item.to} key={item.to}>
            <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <b>{item.label}</b>
              <span style={{ marginLeft: "auto", color: "#9fb0c5" }}>→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
