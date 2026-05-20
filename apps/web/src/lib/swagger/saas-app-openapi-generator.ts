import { generateOpenApiDocument } from "@/lib/openapi/generate-openapi-document";
import { injectProxyRoutesIntoOpenApiDocument } from "@/lib/v1-proxy/manifest";

type SaaSAppOpenAPISpec = ReturnType<typeof generateOpenApiDocument>;

let cachedSaaSAppOpenAPISpec: SaaSAppOpenAPISpec | null = null;

const apiKeyHeaderScheme = {
  type: "apiKey" as const,
  in: "header" as const,
  name: "x-api-key",
  description:
    "Masumi SaaS API key from **API Keys** in the app. Send only this header (no Bearer scheme in this spec).",
};

export function generateSaaSAppOpenAPISpec(): SaaSAppOpenAPISpec {
  if (cachedSaaSAppOpenAPISpec) return cachedSaaSAppOpenAPISpec;

  const base = generateOpenApiDocument(
    "platform",
    {
      openapi: "3.0.0",
      info: {
        version: "1.0.0",
        title: "Masumi SaaS API",
        description: "Authenticated HTTP API for the Masumi SaaS application.",
      },
      servers: [{ url: "/", description: "This app" }],
    },
    {
      mutate: (spec) => ({
        ...spec,
        components: {
          ...(spec.components ?? {}),
          securitySchemes: {
            ...(spec.components?.securitySchemes ?? {}),
            apiKeyHeader: apiKeyHeaderScheme,
          },
        },
      }),
    },
  );

  cachedSaaSAppOpenAPISpec = injectProxyRoutesIntoOpenApiDocument(base);

  return cachedSaaSAppOpenAPISpec;
}
