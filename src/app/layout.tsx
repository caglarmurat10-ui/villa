import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import NavigationBridge from "@/components/NavigationBridge";
import OperationsTopNav from "@/components/OperationsTopNav";
import CookieConsentBanner from "@/components/analytics/CookieConsentBanner";
import { CONSENT_STORAGE_KEY, GTM_ID } from "@/lib/analytics";
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

// Google'ın resmi "Consent Mode + GTM-only" deseni: gtag.js kütüphanesi hiç yüklenmiyor, yalnızca
// standart gtag() shim'i (dataLayer.push(arguments)) consent default/update komutları için var - GTM
// bu formatı gtag.js olmadan da tanır. Bu script GTM yüklenmeden ÖNCE (beforeInteractive) çalışmalı.
// CONSENT_STORAGE_KEY burada literal string olarak gömülür çünkü bu script modül yüklenmeden önce
// çalışıyor - src/lib/analytics.ts'teki CONSENT_STORAGE_KEY ile senkron tutulmalı.
const CONSENT_DEFAULT_SCRIPT = `
(function () {
  try {
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    var stored = null;
    try { stored = JSON.parse(window.localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)}) || "null"); } catch (e) {}
    gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    if (stored && stored.analytics === true) {
      gtag("consent", "update", { analytics_storage: "granted" });
    }
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.start" });
  } catch (e) {}
})();
`;

// Standart GTM yükleme snippet'i - gtm.js dosyasını async olarak ekler (TBT/LCP'yi bloklamaz).
const GTM_LOADER_SCRIPT = `
(function (w, d, s, l, i) {
  w[l] = w[l] || [];
  var f = d.getElementsByTagName(s)[0], j = d.createElement(s), dl = l != "dataLayer" ? "&l=" + l : "";
  j.async = true;
  j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;
  f.parentNode.insertBefore(j, f);
})(window, document, "script", "dataLayer", ${JSON.stringify(GTM_ID)});
`;

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
        {isPublicSite && (
          <>
            <Script id="ga-consent-default" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULT_SCRIPT }} />
            <noscript>
              <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
                height="0"
                width="0"
                style={{ display: "none", visibility: "hidden" }}
                title="Google Tag Manager"
              />
            </noscript>
          </>
        )}
        {!isPublicSite && <NavigationBridge />}
        {!isPublicSite && <OperationsTopNav />}
        {children}
        {isPublicSite && (
          <>
            <Script id="gtm-loader" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: GTM_LOADER_SCRIPT }} />
            <CookieConsentBanner />
          </>
        )}
      </body>
    </html>
  );
}
