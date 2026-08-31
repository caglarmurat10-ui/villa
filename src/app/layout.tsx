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
import "./booking-inquiries.css";

const PUBLIC_HOSTS = new Set(["safiradestan.com", "www.safiradestan.com"]);
const PUBLIC_ORIGIN = "https://safiradestan.com";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("host") ?? "").split(":")[0].toLowerCase();
  const isPublicSite = PUBLIC_HOSTS.has(host);

  if (isPublicSite) {
    return {
      metadataBase: new URL(PUBLIC_ORIGIN),
      title: "Patara Kaş Özel Havuzlu Villa | Safira & Destan Villas",
      description: "Patara, Kaş'ta Villa Safira ve Villa Destan: özel havuzlu villa tatili, canlı müsaitlik, dönemsel fiyat ve doğrudan rezervasyon.",
      applicationName: "Safira & Destan Villas",
      alternates: { canonical: "/" },
      keywords: [
        "Patara villa kiralama",
        "Kaş villa kiralama",
        "Patara özel havuzlu villa",
        "Kaş özel havuzlu villa",
        "Villa Safira",
        "Villa Destan",
        "Patara tatil villası",
        "doğrudan villa rezervasyonu",
      ],
      openGraph: {
        type: "website",
        locale: "tr_TR",
        url: PUBLIC_ORIGIN,
        siteName: "Safira & Destan Villas",
        title: "Patara Kaş Özel Havuzlu Villa | Safira & Destan Villas",
        description: "Villa Safira ve Villa Destan'ı gerçek fotoğraflarıyla keşfedin; canlı müsaitlik ve dönemsel fiyatları doğrudan kontrol edin.",
        images: [
          {
            url: "/villas/safira-hero-20260830.jpg",
            width: 1600,
            height: 1066,
            alt: "Patara Kaş Villa Safira özel havuzlu villa",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Safira & Destan Villas | Patara · Kaş",
        description: "Patara'da özel havuzlu villa, canlı müsaitlik ve doğrudan rezervasyon.",
        images: ["/villas/safira-hero-20260830.jpg"],
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      },
      icons: { icon: [{ url: "/app-icon.svg", type: "image/svg+xml" }] },
    };
  }

  return {
    title: "Villa Yönetim",
    description: "Safira ve Destan rezervasyon yönetim sistemi",
    applicationName: "Villa Yönetim",
    manifest: "/manifest.webmanifest",
    robots: { index: false, follow: false, noarchive: true, nocache: true },
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
