"use client";

import { MasumiSwaggerUi } from "@/components/developers/masumi-swagger-ui";

/**
 * Chrome-free Swagger for iframe embed (Developers → OpenAPI). Full page with header/footer:
 * `/docs/saas-openapi`.
 */
export default function SaasOpenApiEmbedPage() {
  return (
    <div className="min-h-full">
      <MasumiSwaggerUi specUrl="/api/openapi" />
    </div>
  );
}
