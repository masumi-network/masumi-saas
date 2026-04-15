import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { HTTP_METHODS } from "@/lib/openapi/contracts";
import {
  isPlatformDocumentPath,
  isPublicDiscoveryPath,
  shouldHaveRouteContract,
} from "@/lib/openapi/document-filters";
import { routeContractManifest } from "@/lib/openapi/generated/route-contract-manifest";
import { proxyRouteDescriptors } from "@/lib/v1-proxy/manifest";

import { generateOpenAPISpec } from "./public-openapi-generator";
import { generateSaaSAppOpenAPISpec } from "./saas-app-openapi-generator";

type HttpMethod = (typeof HTTP_METHODS)[number];
type OpenApiDocumentLike = {
  paths?: Record<string, any>;
  servers?: Array<{ url?: string }>;
};

function collectRouteFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") {
      files.push(entryPath);
    }
  }

  return files;
}

function toRoutePath(appRoot: string, routeFile: string): string {
  const relativeDir = path.posix.dirname(
    path.relative(appRoot, routeFile).split(path.sep).join("/"),
  );
  const segments = relativeDir
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .map((segment) => {
      const catchAll = /^\[\.\.\.(.+)\]$/.exec(segment);
      if (catchAll) return `{${catchAll[1]}}`;

      const dynamic = /^\[(.+)\]$/.exec(segment);
      if (dynamic) return `{${dynamic[1]}}`;

      return segment;
    });

  return `/${segments.join("/")}`;
}

function hasMethodExport(source: string, method: HttpMethod): boolean {
  return (
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`).test(
      source,
    ) ||
    new RegExp(`export\\s+const\\s+${method}\\s*=`).test(source) ||
    new RegExp(`export\\s*\\{[^}]*\\b${method}\\b[^}]*\\}\\s*from`).test(source)
  );
}

function collectRouteOperations(appRoot: string): Set<string> {
  const operations = new Set<string>();

  for (const routeFile of collectRouteFiles(appRoot)) {
    const routePath = toRoutePath(appRoot, routeFile);
    const source = readFileSync(routeFile, "utf8");

    for (const method of HTTP_METHODS) {
      if (hasMethodExport(source, method)) {
        operations.add(`${method} ${routePath}`);
      }
    }
  }

  return operations;
}

function normalizePath(rawPath: string): string {
  const normalized = rawPath.replace(/\/+/g, "/");
  if (normalized === "") return "/";
  if (normalized === "/") return "/";
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function resolveServerPath(url?: string): string {
  const serverUrl = url?.trim() || "/";
  if (serverUrl.startsWith("http://") || serverUrl.startsWith("https://")) {
    return normalizePath(new URL(serverUrl).pathname || "/");
  }
  return normalizePath(serverUrl.startsWith("/") ? serverUrl : `/${serverUrl}`);
}

function joinServerAndPath(serverUrl: string | undefined, specPath: string) {
  const serverPath = resolveServerPath(serverUrl);
  const normalizedSpecPath = normalizePath(
    specPath.startsWith("/") ? specPath : `/${specPath}`,
  );
  const joined =
    serverPath === "/"
      ? normalizedSpecPath
      : `${serverPath}${normalizedSpecPath}`;

  return normalizePath(joined);
}

function collectSpecOperations(document: OpenApiDocumentLike): Set<string> {
  const operations = new Set<string>();
  const documentServers =
    Array.isArray(document.servers) && document.servers.length > 0
      ? document.servers
      : [{ url: "/" }];

  for (const [specPath, pathItem] of Object.entries(document.paths ?? {})) {
    const pathServers =
      Array.isArray(pathItem.servers) && pathItem.servers.length > 0
        ? (pathItem.servers as Array<{ url?: string }>)
        : documentServers;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method.toLowerCase()];
      if (!operation || typeof operation !== "object") continue;

      const operationServers =
        Array.isArray(
          (operation as { servers?: Array<{ url?: string }> }).servers,
        ) &&
        (operation as { servers?: Array<{ url?: string }> }).servers!.length > 0
          ? (operation as { servers: Array<{ url?: string }> }).servers
          : pathServers;

      for (const server of operationServers) {
        operations.add(`${method} ${joinServerAndPath(server?.url, specPath)}`);
      }
    }
  }

  return operations;
}

function getOperationPath(operation: string): string {
  return operation.slice(operation.indexOf(" ") + 1);
}

function diff(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((item) => !right.has(item)).sort();
}

function collectContractOperations(): Set<string> {
  const operations = new Set<string>();

  for (const entry of routeContractManifest) {
    const contractOperations = entry.contract.operations as Partial<
      Record<HttpMethod, unknown>
    >;
    for (const method of HTTP_METHODS) {
      if (contractOperations[method]) {
        operations.add(`${method} ${entry.routePath}`);
      }
    }
  }

  return operations;
}

describe("OpenAPI route parity", () => {
  const appRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../app",
  );
  const routeFiles = collectRouteFiles(appRoot);
  const routeOperations = collectRouteOperations(appRoot);
  const contractOperations = collectContractOperations();
  const proxyOperations = new Set(
    proxyRouteDescriptors.map(
      (descriptor) => `${descriptor.method} ${descriptor.saasPath}`,
    ),
  );

  it("keeps documented first-party routes paired with adjacent contracts", () => {
    const missingContractFiles = routeFiles
      .filter((routeFile) =>
        shouldHaveRouteContract(toRoutePath(appRoot, routeFile)),
      )
      .filter(
        (routeFile) =>
          !existsSync(path.join(path.dirname(routeFile), "route.contract.ts")),
      )
      .map((routeFile) =>
        path.relative(appRoot, routeFile).split(path.sep).join("/"),
      )
      .sort();

    const requiredContractOperations = new Set(
      [...routeOperations].filter((operation) =>
        shouldHaveRouteContract(getOperationPath(operation)),
      ),
    );

    const missingContractOperations = diff(
      requiredContractOperations,
      contractOperations,
    );
    const unexpectedContractOperations = [...contractOperations]
      .filter((operation) => !requiredContractOperations.has(operation))
      .sort();

    expect({
      missingContractFiles,
      missingContractOperations,
      unexpectedContractOperations,
    }).toEqual({
      missingContractFiles: [],
      missingContractOperations: [],
      unexpectedContractOperations: [],
    });
  });

  it("keeps the platform spec aligned with documented runtime routes", () => {
    const firstPartyPlatformOperations = new Set(
      [...routeOperations].filter(
        (operation) =>
          shouldHaveRouteContract(getOperationPath(operation)) &&
          isPlatformDocumentPath(getOperationPath(operation)),
      ),
    );
    const requiredPlatformOperations = new Set([
      ...firstPartyPlatformOperations,
      ...proxyOperations,
    ]);
    const platformSpecOperations = collectSpecOperations(
      generateSaaSAppOpenAPISpec(),
    );

    const missingSpecOperations = diff(
      requiredPlatformOperations,
      platformSpecOperations,
    );
    const unexpected = [...platformSpecOperations]
      .filter((operation) => !requiredPlatformOperations.has(operation))
      .sort();

    expect({
      missingSpecOperations,
      unexpected,
    }).toEqual({
      missingSpecOperations: [],
      unexpected: [],
    });
  });

  it("keeps the public discovery spec aligned with the public /api/v1 agent routes", () => {
    const publicRouteOperations = new Set(
      [...routeOperations].filter((operation) =>
        isPublicDiscoveryPath(getOperationPath(operation)),
      ),
    );
    const publicSpecOperations = collectSpecOperations(generateOpenAPISpec());

    const missing = diff(publicRouteOperations, publicSpecOperations);
    const unexpected = [...publicSpecOperations]
      .filter((operation) => !publicRouteOperations.has(operation))
      .sort();

    expect({ missing, unexpected }).toEqual({ missing: [], unexpected: [] });
  });
});
