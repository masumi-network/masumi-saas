import paymentNodeOpenApi from "../../../scripts/specs/payment-node-openapi.json";
import registryServiceOpenApi from "../../../scripts/specs/registry-service-openapi.json";

type ProxyOperationMethodLower = "get" | "post" | "patch" | "delete";

export type ProxyOperationMethod = Uppercase<ProxyOperationMethodLower>;
export type ProxyUpstream = "payment" | "registry";
export type ProxyAuthMode = "payment-user-token" | "registry-shared-token";

type OpenApiPathItemObject = Partial<
  Record<ProxyOperationMethodLower, Record<string, unknown>>
>;

type OpenApiDocument = {
  paths: Record<string, OpenApiPathItemObject>;
  components?: Record<string, Record<string, unknown>>;
};

type ProxyRouteDefinition = {
  upstream: ProxyUpstream;
  upstreamPath: string;
  authMode: ProxyAuthMode;
  methods?: readonly ProxyOperationMethod[];
};

export type ProxyRouteDescriptor = {
  key: string;
  method: ProxyOperationMethod;
  normalizedPath: string;
  openapiPath: string;
  saasPath: string;
  upstream: ProxyUpstream;
  upstreamPath: string;
  authMode: ProxyAuthMode;
  operation: Record<string, unknown>;
};

type ProxyManifestBuildResult = {
  descriptors: ProxyRouteDescriptor[];
  byKey: ReadonlyMap<string, ProxyRouteDescriptor>;
};

type ProxyDocOperation = Record<string, unknown>;
type MutableOpenApiDocumentLike = {
  paths: Record<string, Record<string, unknown>>;
  components: Record<string, Record<string, unknown>>;
};

const OPERATION_METHODS = ["get", "post", "patch", "delete"] as const;
const OPERATION_METHODS_UPPER = OPERATION_METHODS.map((method) =>
  method.toUpperCase(),
) as ProxyOperationMethod[];
const COMPONENT_SECTIONS = [
  "schemas",
  "responses",
  "parameters",
  "requestBodies",
  "headers",
  "examples",
  "links",
  "callbacks",
] as const;

const PAYMENT_PROXY_ROUTE_DEFINITIONS: readonly ProxyRouteDefinition[] = [
  {
    upstream: "payment",
    upstreamPath: "/payment",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/payment-source",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/payment/authorize-refund",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/payment/count",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/payment/diff",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/payment/diff/next-action",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/payment/diff/onchain-state-or-result",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/payment/error-state-recovery",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/payment/income",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/payment/resolve-blockchain-identifier",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/payment/submit-result",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/registry",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/registry/agent-identifier",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/registry/count",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/registry/deregister",
    authMode: "payment-user-token",
  },
  {
    upstream: "payment",
    upstreamPath: "/registry/diff",
    authMode: "payment-user-token",
  },
] as const;

const REGISTRY_PROXY_ROUTE_DEFINITIONS: readonly ProxyRouteDefinition[] = [
  {
    upstream: "registry",
    upstreamPath: "/registry-entry/",
    authMode: "registry-shared-token",
  },
  {
    upstream: "registry",
    upstreamPath: "/registry-diff/",
    authMode: "registry-shared-token",
  },
  {
    upstream: "registry",
    upstreamPath: "/payment-information/",
    authMode: "registry-shared-token",
  },
  {
    upstream: "registry",
    upstreamPath: "/capability/",
    authMode: "registry-shared-token",
  },
] as const;

export const SAFE_PROXY_ROUTE_DEFINITIONS: readonly ProxyRouteDefinition[] = [
  ...PAYMENT_PROXY_ROUTE_DEFINITIONS,
  ...REGISTRY_PROXY_ROUTE_DEFINITIONS,
] as const;

const UPSTREAM_OPENAPI_SPECS: Readonly<Record<ProxyUpstream, OpenApiDocument>> =
  {
    payment: paymentNodeOpenApi as OpenApiDocument,
    registry: registryServiceOpenApi as OpenApiDocument,
  };

function normalizeSpecPathToSaasPath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function makeProxyRouteKey(
  method: ProxyOperationMethod,
  normalizedPath: string,
): string {
  return `${method} ${normalizedPath}`;
}

function getOpenApiOperation(
  spec: OpenApiDocument,
  upstream: ProxyUpstream,
  upstreamPath: string,
  method: ProxyOperationMethodLower,
): Record<string, unknown> {
  const pathItem = spec.paths[upstreamPath];
  if (!pathItem) {
    throw new Error(
      `[v1-proxy] Missing ${upstream} path ${upstreamPath} in checked-in OpenAPI spec`,
    );
  }

  const operation = pathItem[method];
  if (!operation) {
    throw new Error(
      `[v1-proxy] Missing ${method.toUpperCase()} ${upstreamPath} in ${upstream} OpenAPI spec`,
    );
  }

  return operation;
}

function toLowerProxyMethod(
  method: ProxyOperationMethod,
): ProxyOperationMethodLower {
  return method.toLowerCase() as ProxyOperationMethodLower;
}

export function buildProxyRouteManifest(
  routeDefinitions: readonly ProxyRouteDefinition[],
  upstreamSpecs: Readonly<
    Record<ProxyUpstream, OpenApiDocument>
  > = UPSTREAM_OPENAPI_SPECS,
): ProxyManifestBuildResult {
  const descriptors: ProxyRouteDescriptor[] = [];
  const byKey = new Map<string, ProxyRouteDescriptor>();

  for (const definition of routeDefinitions) {
    const spec = upstreamSpecs[definition.upstream];
    const normalizedPath = normalizeSpecPathToSaasPath(definition.upstreamPath);
    const allowedMethods = (definition.methods ?? OPERATION_METHODS_UPPER).map(
      toLowerProxyMethod,
    );

    let supportedMethodCount = 0;

    for (const method of allowedMethods) {
      const operation = spec.paths[definition.upstreamPath]?.[method];
      if (!operation) continue;

      supportedMethodCount += 1;
      const descriptor: ProxyRouteDescriptor = {
        key: makeProxyRouteKey(
          method.toUpperCase() as ProxyOperationMethod,
          normalizedPath,
        ),
        method: method.toUpperCase() as ProxyOperationMethod,
        normalizedPath,
        openapiPath: `/v1/${normalizedPath}`,
        saasPath: `/api/v1/${normalizedPath}`,
        upstream: definition.upstream,
        upstreamPath: definition.upstreamPath,
        authMode: definition.authMode,
        operation: getOpenApiOperation(
          spec,
          definition.upstream,
          definition.upstreamPath,
          method,
        ),
      };

      if (byKey.has(descriptor.key)) {
        throw new Error(`[v1-proxy] Duplicate proxy route ${descriptor.key}`);
      }

      descriptors.push(descriptor);
      byKey.set(descriptor.key, descriptor);
    }

    if (supportedMethodCount === 0) {
      throw new Error(
        `[v1-proxy] ${definition.upstreamPath} has no supported operations in ${definition.upstream} OpenAPI spec`,
      );
    }
  }

  return { descriptors, byKey };
}

const manifest = buildProxyRouteManifest(SAFE_PROXY_ROUTE_DEFINITIONS);

export const proxyRouteDescriptors = manifest.descriptors;

export function getProxyRouteDescriptor(
  method: ProxyOperationMethod,
  normalizedPath: string,
): ProxyRouteDescriptor | undefined {
  return manifest.byKey.get(makeProxyRouteKey(method, normalizedPath));
}

function getUpstreamComponentPrefix(upstream: ProxyUpstream): string {
  return upstream === "payment" ? "PaymentProxy_" : "RegistryProxy_";
}

function rewriteComponentRefs(value: unknown, prefix: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteComponentRefs(item, prefix));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, child]) => {
      if (
        key === "$ref" &&
        typeof child === "string" &&
        child.startsWith("#/components/")
      ) {
        const [, , section, name] = child.split("/");
        return [key, `#/components/${section}/${prefix}${name}`];
      }

      return [key, rewriteComponentRefs(child, prefix)];
    },
  );

  return Object.fromEntries(entries);
}

function mergePrefixedComponents(
  document: MutableOpenApiDocumentLike,
  upstream: ProxyUpstream,
): void {
  const spec = UPSTREAM_OPENAPI_SPECS[upstream];
  const prefix = getUpstreamComponentPrefix(upstream);

  if (!spec.components) return;

  document.components ??= {};

  for (const section of COMPONENT_SECTIONS) {
    const componentGroup = spec.components[section];
    if (!componentGroup) continue;

    const targetGroup = (document.components[section] ??= {});
    for (const [name, component] of Object.entries(componentGroup)) {
      targetGroup[`${prefix}${name}`] = rewriteComponentRefs(
        structuredClone(component),
        prefix,
      ) as Record<string, unknown>;
    }
  }
}

function buildProxyOperationDescription(
  descriptor: ProxyRouteDescriptor,
  upstreamOperation: ProxyDocOperation,
): string {
  const upstreamLabel =
    descriptor.upstream === "payment"
      ? "Masumi payment service"
      : "Masumi registry service";
  const lines = [
    `Proxied via Masumi SaaS to the ${upstreamLabel}. Authenticate here with a browser session or Masumi SaaS API key; SaaS forwards the upstream token server-side.`,
  ];

  const upstreamDescription = upstreamOperation.description;
  if (typeof upstreamDescription === "string" && upstreamDescription.trim()) {
    lines.push(upstreamDescription.trim());
  }

  return lines.join("\n\n");
}

function buildInsufficientCreditsResponse(): Record<string, unknown> {
  return {
    description: "Insufficient credits",
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["success", "error", "creditsRemaining", "requiredCredits"],
          properties: {
            success: { type: "boolean", enum: [false] },
            error: { type: "string", enum: ["Insufficient credits"] },
            creditsRemaining: { type: "number" },
            requiredCredits: { type: "number", enum: [1] },
          },
        },
      },
    },
  };
}

export function injectProxyRoutesIntoOpenApiDocument<T>(baseDocument: T): T {
  const document = structuredClone(baseDocument) as T &
    MutableOpenApiDocumentLike;

  document.paths ??= {};
  document.components ??= {};

  for (const upstream of ["payment", "registry"] as const) {
    mergePrefixedComponents(document, upstream);
  }

  for (const descriptor of proxyRouteDescriptors) {
    const pathItem = (document.paths[descriptor.openapiPath] ??= {});
    const prefixedOperation = rewriteComponentRefs(
      structuredClone(descriptor.operation),
      getUpstreamComponentPrefix(descriptor.upstream),
    ) as ProxyDocOperation;

    prefixedOperation.security = [{ apiKeyHeader: [] }];
    prefixedOperation.description = buildProxyOperationDescription(
      descriptor,
      prefixedOperation,
    );
    if (
      descriptor.authMode === "payment-user-token" &&
      descriptor.method !== "GET"
    ) {
      const responses = (prefixedOperation.responses ??= {}) as Record<
        string,
        unknown
      >;
      responses["402"] ??= buildInsufficientCreditsResponse();
    }

    pathItem[descriptor.method.toLowerCase()] = prefixedOperation;
  }

  return document as T;
}
