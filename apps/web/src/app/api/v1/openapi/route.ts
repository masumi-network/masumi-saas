import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders } from "@/lib/api/cors";
import { generateOpenAPISpec } from "@/lib/swagger/public-openapi-generator";

export async function GET(request: NextRequest) {
  const spec = generateOpenAPISpec();
  const response = NextResponse.json(spec);
  // Public discovery spec; safe for CDN. Updates only when API surface changes.
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400",
  );
  return addCorsHeaders(response, request);
}
