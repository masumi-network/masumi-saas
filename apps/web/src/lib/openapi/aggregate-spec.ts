import { OpenAPIHono } from "@hono/zod-openapi";

import { z } from "@/lib/zod-openapi";

import {
  routeAppManifest,
  type RouteAppManifestEntry,
  type RouteDocumentKey,
} from "./generated/route-app-manifest";

const DEFAULT_DOCUMENT: RouteDocumentKey = "platform";

function documentsForEntry(entry: RouteAppManifestEntry): RouteDocumentKey[] {
  const declared = entry.meta?.documents;
  if (declared && declared.length > 0) {
    return [...declared];
  }
  return [DEFAULT_DOCUMENT];
}

/**
 * Convert Hono-style path params (`:agentId`) back to OpenAPI-style
 * (`{agentId}`) in the emitted spec. Necessary because `createApiApp`
 * rewrites OpenAPI param syntax to Hono syntax for runtime routing.
 */
function honoToOpenApiPaths<T extends { paths?: Record<string, unknown> }>(
  document: T,
): T {
  if (!document.paths) return document;
  const rewritten: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(document.paths)) {
    const fixed = path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}");
    rewritten[fixed] = value;
  }
  return { ...document, paths: rewritten };
}

type PathAlias = {
  canonical: string;
  alias: string;
  /** Restrict the alias to a single HTTP method if the alias only forwards one. */
  method?: "get" | "post" | "put" | "patch" | "delete";
};

const PATH_ALIASES: ReadonlyArray<PathAlias> = [
  { canonical: "/api/credits", alias: "/credits" },
  {
    canonical: "/api/v1/inbox-agents",
    alias: "/api/masumi/inbox-agent/register",
    method: "post",
  },
  // /pay/api/v1/inbox-agents/* were the legacy-documented paths. Both routes
  // still serve those URLs at runtime (via nextHandlers URL aliasing) — expose
  // them in the spec so existing clients that read the legacy paths keep
  // working.
  { canonical: "/api/v1/inbox-agents", alias: "/pay/api/v1/inbox-agents" },
  {
    canonical: "/api/v1/inbox-agents/{inboxAgentId}",
    alias: "/pay/api/v1/inbox-agents/{inboxAgentId}",
  },
  {
    canonical: "/api/v1/inbox-agents/{inboxAgentId}/deregister",
    alias: "/pay/api/v1/inbox-agents/{inboxAgentId}/deregister",
  },
];

function addPathAliases<T extends { paths?: unknown }>(document: T): T {
  if (!document.paths || typeof document.paths !== "object") return document;
  const paths = document.paths as Record<string, Record<string, unknown>>;
  const next: Record<string, Record<string, unknown>> = { ...paths };
  for (const { canonical, alias, method } of PATH_ALIASES) {
    const source = next[canonical];
    if (!source) continue;
    if (method) {
      const op = source[method];
      if (!op) continue;
      next[alias] = { ...(next[alias] ?? {}), [method]: op };
    } else {
      next[alias] = { ...(next[alias] ?? {}), ...source };
    }
  }
  return { ...document, paths: next };
}

export type OpenApiAggregateConfig = Parameters<
  OpenAPIHono["getOpenAPIDocument"]
>[0];

export function aggregateOpenApiDocument(
  document: RouteDocumentKey,
  config: OpenApiAggregateConfig,
) {
  const root = new OpenAPIHono();
  for (const entry of routeAppManifest) {
    if (!documentsForEntry(entry).includes(document)) continue;
    root.route("/", entry.app);
  }
  const doc = root.getOpenAPIDocument(config);
  return addPathAliases(honoToOpenApiPaths(doc));
}

export type AggregatedOpenApiDocument = ReturnType<
  typeof aggregateOpenApiDocument
>;

// Re-export z so callers don't need a second import path.
export { z };
