import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  hasUnsafeEncodedProxyPath,
  normalizeProxyPathname,
} from "@/lib/v1-proxy/path";

export async function proxy(request: NextRequest) {
  if (hasUnsafeEncodedProxyPath(request.url)) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }

  if (request.nextUrl.pathname.startsWith("/api/v1/")) {
    const normalizedPath = normalizeProxyPathname(request.nextUrl.pathname);
    if (!normalizedPath.ok) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/v1/:path*",
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
