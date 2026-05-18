import {
  type AggregatedOpenApiDocument,
  aggregateOpenApiDocument,
  type OpenApiAggregateConfig,
} from "./aggregate-spec";
import type { RouteDocumentKey } from "./generated/route-app-manifest";

export type OpenApiDocumentKey = RouteDocumentKey;

export function generateOpenApiDocument(
  document: OpenApiDocumentKey,
  config: OpenApiAggregateConfig,
  options?: {
    /** Mutate the produced spec right before it's returned (e.g. add components). */
    mutate?: (spec: AggregatedOpenApiDocument) => AggregatedOpenApiDocument;
  },
): AggregatedOpenApiDocument {
  const spec = aggregateOpenApiDocument(document, config);
  return options?.mutate ? options.mutate(spec) : spec;
}
