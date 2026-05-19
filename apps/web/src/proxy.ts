import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function getRawPathname(url: string): string {
  const protocolSeparator = url.indexOf("://");
  const pathStart =
    protocolSeparator >= 0 ? url.indexOf("/", protocolSeparator + 3) : 0;
  if (pathStart < 0) return "/";

  const queryStart = url.indexOf("?", pathStart);
  const hashStart = url.indexOf("#", pathStart);
  const pathEnd = [queryStart, hashStart]
    .filter((index) => index >= 0)
    .reduce((lowest, index) => Math.min(lowest, index), url.length);

  return url.slice(pathStart, pathEnd);
}

export function hasApiV1DotSegmentTraversal(url: string): boolean {
  const pathname = getRawPathname(url);
  if (pathname !== "/api/v1" && !pathname.startsWith("/api/v1/")) {
    return false;
  }

  return /(?:^|\/|%2f)(?:\.|%2e){1,2}(?=\/|%2f|$)/i.test(pathname);
}

export async function proxy(request: NextRequest) {
  if (hasApiV1DotSegmentTraversal(request.url)) {
    return new NextResponse(null, { status: 404 });
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
