import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders } from "@/lib/api/cors";
import { generateSaaSAppOpenAPISpec } from "@/lib/swagger/saas-app-openapi";

/**
 * OpenAPI 3.0 JSON for the **Masumi Platform (SaaS) HTTP API** (`/api/*` authenticated surface).
 * Public agent-discovery spec remains at `GET /api/v1/openapi`.
 */
export async function GET(request: NextRequest) {
  const spec = generateSaaSAppOpenAPISpec();
  return addCorsHeaders(NextResponse.json(spec), request);
}
