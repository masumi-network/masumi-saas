import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";

import {
  HTTP_METHODS,
  type HttpMethod,
  type OpenApiDocumentKey,
  type RouteContractManifestEntry,
} from "./contracts";
import { routeContractManifest } from "./generated/route-contract-manifest";

function toOpenApiMethod(method: HttpMethod) {
  return method.toLowerCase() as Lowercase<HttpMethod>;
}

function registerManifestRoutes(
  registry: OpenAPIRegistry,
  document: OpenApiDocumentKey,
  manifest: readonly RouteContractManifestEntry[],
) {
  for (const entry of manifest) {
    if (!entry.contract.documents.includes(document)) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = entry.contract.operations[method];
      if (!operation) {
        continue;
      }

      registry.registerPath({
        ...operation,
        method: toOpenApiMethod(method),
        path: entry.routePath,
        request: operation.request as RouteConfig["request"],
        responses: operation.responses as RouteConfig["responses"],
        tags:
          operation.tags && operation.tags.length > 0
            ? operation.tags
            : entry.contract.tags,
      });
    }
  }
}

export function generateOpenApiDocument(
  document: OpenApiDocumentKey,
  config: {
    openapi: "3.0.0";
    info: {
      version: string;
      title: string;
      description: string;
    };
    servers?: Array<{ url: string; description?: string }>;
  },
  options?: {
    manifest?: readonly RouteContractManifestEntry[];
    registerComponents?: (registry: OpenAPIRegistry) => void;
  },
) {
  const registry = new OpenAPIRegistry();
  options?.registerComponents?.(registry);
  registerManifestRoutes(
    registry,
    document,
    options?.manifest ?? routeContractManifest,
  );

  return new OpenApiGeneratorV3(registry.definitions).generateDocument(config);
}
