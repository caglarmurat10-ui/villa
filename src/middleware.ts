import { NextRequest, NextResponse } from "next/server";

const PUBLIC_HOSTS = new Set(["safiradestan.com", "www.safiradestan.com"]);
const ADMIN_HOSTS = new Set(["admin.safiradestan.com"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const PUBLIC_API_PATHS = new Set([
  "/api/health",
  "/api/system/version",
  "/api/public/booking-inquiries",
]);
const WORKER_ALLOWED_PATHS = new Set([
  "/api/health",
  "/api/system/version",
  "/api/meta/instagram/connect",
  "/api/meta/instagram/callback",
  "/api/meta/facebook/callback",
]);
const PUBLIC_REWRITES = new Map([
  ["/", "/site"],
  ["/villa-safira", "/site/villa-safira"],
  ["/villa-destan", "/site/villa-destan"],
]);
const PUBLIC_INTERNAL_PATHS = new Set(["/site", "/site/villa-safira", "/site/villa-destan"]);

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
    return PUBLIC_API_PATHS.has(pathname) ? NextResponse.next() : notFound();
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
