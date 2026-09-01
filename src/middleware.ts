import { NextRequest, NextResponse } from "next/server";

const PUBLIC_HOSTS = new Set(["safiradestan.com", "www.safiradestan.com"]);
const ADMIN_HOSTS = new Set(["admin.safiradestan.com"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/system/version",
  "/api/public/booking-inquiries",
  "/api/weather/ingest",
  "/api/weather/current",
  "/api/payments/checkout",
  "/api/payments/paytr/callback",
]);
// Dinamik token segmenti taşıyan public API yolları - şu an yalnız OTA export feed'i.
const PUBLIC_API_PATH_PREFIXES = ["/api/calendar/export/"];
// /odeme/[paymentId](/basarili|/basarisiz) - src/app/odeme/... altında zaten gerçek route, rewrite
// gerekmez.
const PUBLIC_PASSTHROUGH_PREFIXES = ["/odeme/"];
const WORKER_ALLOWED_PATHS = new Set([
  "/api/health",
  "/api/system/version",
  "/api/meta/instagram/connect",
  "/api/meta/instagram/callback",
  "/api/meta/facebook/callback",
]);
// /rehber alt sayfaları - REGION_GUIDE_PAGE_SLUGS (src/lib/region-guide-pages.ts) ile birebir
// eşleşmeli. Yeni bir rehber alt sayfası eklerken hem oradaki listeye hem buradaki iki map'e
// (custom-worker.mjs'teki PUBLIC_ROUTE_MAP dahil) ekleme yapılmalı - yoksa route 404 verir.
const REGION_GUIDE_SLUGS = ["patara", "patara-plaji", "patara-antik-kenti", "kas", "kalkan"];
const PUBLIC_REWRITES = new Map([
  ["/", "/site"],
  ["/villa-safira", "/site/villa-safira"],
  ["/villa-destan", "/site/villa-destan"],
  ["/rezervasyon-kosullari", "/site/rezervasyon-kosullari"],
  ["/rehber", "/site/rehber"],
  ...REGION_GUIDE_SLUGS.map((slug): [string, string] => [`/rehber/${slug}`, `/site/rehber/${slug}`]),
]);
const PUBLIC_INTERNAL_PATHS = new Set([
  "/site", "/site/villa-safira", "/site/villa-destan", "/site/rezervasyon-kosullari", "/site/rehber",
  ...REGION_GUIDE_SLUGS.map((slug) => `/site/rehber/${slug}`),
]);

function notFound() {
  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const { pathname } = request.nextUrl;

  if (LOCAL_HOSTS.has(host) || ADMIN_HOSTS.has(host)) {
    return NextResponse.next();
  }

  if (host.endsWith(".workers.dev")) {
    return WORKER_ALLOWED_PATHS.has(pathname) ? NextResponse.next() : notFound();
  }

  if (!PUBLIC_HOSTS.has(host)) {
    return notFound();
  }

  if (pathname.startsWith("/api/")) {
    const allowed = PUBLIC_API_PATHS.has(pathname) || PUBLIC_API_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    return allowed ? NextResponse.next() : notFound();
  }

  if (pathname === "/manifest.webmanifest") {
    return NextResponse.next();
  }

  if (PUBLIC_PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const rewritePath = PUBLIC_REWRITES.get(pathname);
  if (rewritePath) {
    const url = request.nextUrl.clone();
    url.pathname = rewritePath;
    return NextResponse.rewrite(url);
  }

  if (PUBLIC_INTERNAL_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  return notFound();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
