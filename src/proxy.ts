import { NextRequest, NextResponse } from "next/server";

const PUBLIC_HOSTS = new Set(["safiradestan.com", "www.safiradestan.com"]);

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();

  if (!PUBLIC_HOSTS.has(host)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/site";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/villa-safira" || pathname === "/villa-destan") {
    const url = request.nextUrl.clone();
    url.pathname = `/site${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
