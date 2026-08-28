import type { Metadata, Viewport } from "next";
import NavigationBridge from "@/components/NavigationBridge";
import "./globals.css";
import "./social.css";
import "./social-approval.css";
import "./social-content-library.css";
import "./meta-diagnostics.css";
import "./brand-profile.css";
import "./message.css";
import "./navigation.css";

export const metadata: Metadata = {
  title: "Villa Yönetim",
  description: "Safira ve Destan rezervasyon yönetim sistemi",
  applicationName: "Villa Yönetim",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/app-icon.svg", type: "image/svg+xml" },
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/app-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Villa Yönetim", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#4338ca",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body><NavigationBridge />{children}<a className="social-shortcut" href="/sosyal">◎ Sosyal</a></body></html>;
}
