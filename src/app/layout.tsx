import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import NavigationBridge from "@/components/NavigationBridge";
import OperationsTopNav from "@/components/OperationsTopNav";
import "./globals.css";
import "./social.css";
import "./social-approval.css";
import "./social-content-library.css";
import "./social-media-picker.css";
import "./meta-diagnostics.css";
import "./brand-profile.css";
import "./brand-account-status.css";
import "./brand-assets.css";
import "./message.css";
import "./navigation.css";
import "./operations-shell.css";
import "./calendar-workspace.css";
import "./settings-center.css";

const PUBLIC_HOSTS = new Set(["safiradestan.com", "www.safiradestan.com"]);

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("host") ?? "").split(":")[0].toLowerCase();
  const isPublicSite = PUBLIC_HOSTS.has(host);

  if (isPublicSite) {
    return {
      title: "Safira & Destan Villas | Patara · Kaş",
      description: "Villa Safira ve Villa Destan için doğrudan tanıtım, müsaitlik ve rezervasyon sitesi.",
      applicationName: "Safira & Destan Villas",
      icons: { icon: [{ url: "/app-icon.svg", type: "image/svg+xml" }] },
    };
  }

  return {
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
}

export const viewport: Viewport = {
  themeColor: "#4338ca",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("host") ?? "").split(":")[0].toLowerCase();
  const isPublicSite = PUBLIC_HOSTS.has(host);

  return (
    <html lang="tr">
      <body>
        {!isPublicSite && <NavigationBridge />}
        {!isPublicSite && <OperationsTopNav />}
        {children}
      </body>
    </html>
  );
}
