import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import { generateSaaSAppOpenAPISpec } from "@/lib/swagger/saas-app-openapi";

/**
 * OpenAPI 3.0 JSON for the **Masumi SaaS** HTTP API (`/api/*` authenticated surface).
 * Public agent-discovery spec remains at `GET /api/v1/openapi`.
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightResponse(request);
}

export async function GET(request: NextRequest) {
  const spec = generateSaaSAppOpenAPISpec();
  const response = NextResponse.json(spec);
  response.headers.set("Cache-Control", "private, no-store, must-revalidate");
  return addCorsHeaders(response, request);
}
