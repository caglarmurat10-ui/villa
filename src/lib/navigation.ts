export type DashboardView = "dashboard" | "calendar" | "messages" | "cleaning" | "reports" | "calculator" | "settings";

type ViewNavigationItem = {
  kind: "view";
  id: string;
  view: DashboardView;
  label: string;
  icon: string;
  anchor?: "reservations";
};

type LinkNavigationItem = {
  kind: "link";
  id: string;
  href: "/sosyal";
  label: string;
  icon: string;
};

export type MainNavigationItem = ViewNavigationItem | LinkNavigationItem;

export const mainNavigationItems: MainNavigationItem[] = [
  { kind: "view", id: "home", view: "dashboard", label: "Ana Panel", icon: "⌂" },
  { kind: "view", id: "reservations", view: "dashboard", label: "Rezervasyonlar", icon: "▤", anchor: "reservations" },
  { kind: "view", id: "calendar", view: "calendar", label: "Takvim", icon: "▦" },
  { kind: "view", id: "reports", view: "reports", label: "Hesaplamalar", icon: "▥" },
  { kind: "view", id: "settings", view: "settings", label: "Ayarlar", icon: "⚙" },
  { kind: "link", id: "social", href: "/sosyal", label: "Sosyal Medya", icon: "◎" },
  { kind: "view", id: "messages", view: "messages", label: "Mesajlar", icon: "✉" },
  { kind: "view", id: "cleaning", view: "cleaning", label: "Temizlik", icon: "✦" },
  { kind: "view", id: "calculator", view: "calculator", label: "Hızlı Hesap", icon: "₺" },
];
