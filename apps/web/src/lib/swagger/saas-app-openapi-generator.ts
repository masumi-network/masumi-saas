import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

import { generateOpenApiDocument } from "@/lib/openapi/generate-openapi-document";
import { injectProxyRoutesIntoOpenApiDocument } from "@/lib/v1-proxy/manifest";

type SaaSAppOpenAPISpec = ReturnType<typeof generateOpenApiDocument>;

let cachedSaaSAppOpenAPISpec: SaaSAppOpenAPISpec | null = null;

function registerSaaSSecuritySchemes(registry: OpenAPIRegistry) {
  registry.registerComponent("securitySchemes", "apiKeyHeader", {
    type: "apiKey",
    in: "header",
    name: "x-api-key",
    description:
      "Masumi SaaS API key from **API Keys** in the app. Send only this header (no Bearer scheme in this spec).",
  });
}

export function generateSaaSAppOpenAPISpec(): SaaSAppOpenAPISpec {
  if (cachedSaaSAppOpenAPISpec) return cachedSaaSAppOpenAPISpec;

  cachedSaaSAppOpenAPISpec = injectProxyRoutesIntoOpenApiDocument(
    generateOpenApiDocument(
      "platform",
      {
        openapi: "3.0.0",
        info: {
          version: "1.0.0",
          title: "Masumi SaaS API",
          description:
            "Authenticated HTTP API for the Masumi SaaS application.",
        },
        servers: [{ url: "/", description: "This app" }],
      },
      {
        registerComponents: registerSaaSSecuritySchemes,
      },
    ),
  );

  return cachedSaaSAppOpenAPISpec;
}
