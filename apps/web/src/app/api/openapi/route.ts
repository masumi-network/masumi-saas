import { NextRequest, NextResponse } from "next/server";

import { addCorsHeaders, handleCorsPreflightResponse } from "@/lib/api/cors";
import fallbackSaaSAppOpenApiSpec from "@/lib/swagger/openapi-platform-docs.json";
import { generateSaaSAppOpenAPISpec } from "@/lib/swagger/saas-app-openapi-generator";

/**
 * OpenAPI 3.0 JSON for the **Masumi SaaS** HTTP API (`/api/*` authenticated surface).
 * Public agent-discovery spec remains at `GET /api/v1/openapi`.
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightResponse(request);
}

export async function GET(request: NextRequest) {
  const spec = (() => {
    try {
      return generateSaaSAppOpenAPISpec();
    } catch (error) {
      console.error(
        "Failed to generate /api/openapi spec, serving checked-in snapshot:",
        error,
      );
      return fallbackSaaSAppOpenApiSpec;
    }
  })();
  const response = NextResponse.json(spec);
  // Same spec for every authed user; browser can reuse during a Swagger session
  // (private — never share across users via shared caches/CDNs).
  response.headers.set(
    "Cache-Control",
    "private, max-age=300, must-revalidate",
  );
  return addCorsHeaders(response, request);
}
