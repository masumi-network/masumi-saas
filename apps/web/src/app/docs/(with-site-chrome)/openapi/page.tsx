"use client";

import { MasumiSwaggerUi } from "@/components/developers/masumi-swagger-ui";
import { SwaggerPoweredByNote } from "@/components/developers/swagger-powered-by-note";

/**
 * Full-page Swagger UI for the public v1 OpenAPI document (`GET /api/v1/openapi`).
 */
export default function OpenApiExplorerPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border/80 bg-background px-4 py-3 sm:px-6">
        <div className="max-w-container mx-auto">
          <SwaggerPoweredByNote />
        </div>
      </div>
      <div className="min-h-[min(100vh,1200px)] flex-1">
        <MasumiSwaggerUi specUrl="/api/v1/openapi" />
      </div>
    </div>
  );
}
