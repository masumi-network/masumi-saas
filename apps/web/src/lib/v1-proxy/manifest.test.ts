import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildProxyRouteManifest,
  getProxyRouteDescriptor,
  injectProxyRoutesIntoOpenApiDocument,
  proxyRouteDescriptors,
} from "./manifest";

describe("v1 proxy manifest", () => {
  it("includes generated payment and registry descriptors", () => {
    const registryRoute = getProxyRouteDescriptor("POST", "registry-entry");
    const registrySearchRoute = getProxyRouteDescriptor(
      "POST",
      "registry-entry-search",
    );
    const inboxSearchRoute = getProxyRouteDescriptor(
      "POST",
      "inbox-agent-registration-search",
    );
    const paymentRoute = getProxyRouteDescriptor("POST", "payment");

    expect(registryRoute).toMatchObject({
      upstream: "registry",
      authMode: "registry-shared-token",
      upstreamPath: "/registry-entry/",
      openapiPath: "/v1/registry-entry",
    });
    expect(registrySearchRoute).toMatchObject({
      upstream: "registry",
      authMode: "registry-shared-token",
      upstreamPath: "/registry-entry-search/",
      openapiPath: "/v1/registry-entry-search",
    });
    expect(inboxSearchRoute).toMatchObject({
      upstream: "registry",
      authMode: "registry-shared-token",
      upstreamPath: "/inbox-agent-registration-search/",
      openapiPath: "/v1/inbox-agent-registration-search",
    });
    expect(paymentRoute).toMatchObject({
      upstream: "payment",
      authMode: "payment-user-token",
      upstreamPath: "/payment",
      openapiPath: "/v1/payment",
    });
    expect(getProxyRouteDescriptor("GET", "registry-inbox")).toBeUndefined();
    expect(getProxyRouteDescriptor("POST", "inbox-agent-registration")).toBe(
      undefined,
    );
  });

  it("throws when a configured route is missing from the upstream spec", () => {
    expect(() =>
      buildProxyRouteManifest([
        {
          upstream: "registry",
          upstreamPath: "/does-not-exist/",
          authMode: "registry-shared-token",
        },
      ]),
    ).toThrow("/does-not-exist/");
  });

  it("injects proxy routes into the SaaS OpenAPI document", () => {
    const spec = injectProxyRoutesIntoOpenApiDocument({
      paths: {},
      components: {},
    } as {
      paths: Record<string, Record<string, unknown>>;
      components: Record<string, Record<string, unknown>>;
    });

    const registryPost = spec.paths["/v1/registry-entry"]?.post as
      | Record<string, unknown>
      | undefined;
    const paymentPost = spec.paths["/v1/payment"]?.post as
      | Record<string, unknown>
      | undefined;

    expect(registryPost?.security).toStrictEqual([{ apiKeyHeader: [] }]);
    expect(paymentPost?.security).toStrictEqual([{ apiKeyHeader: [] }]);
    expect(paymentPost?.responses).toMatchObject({
      402: {
        description: "Insufficient credits",
      },
    });
    expect((registryPost?.responses as Record<string, unknown>)?.["402"]).toBe(
      undefined,
    );
    expect(spec.components.schemas).toBeDefined();
    expect(
      Object.keys(spec.components.schemas ?? {}).some((name) =>
        name.startsWith("RegistryProxy_"),
      ),
    ).toBe(true);
    expect(
      Object.keys(spec.components.schemas ?? {}).some((name) =>
        name.startsWith("PaymentProxy_"),
      ),
    ).toBe(true);
    expect(spec.paths["/v1/registry-inbox"]).toBeUndefined();
    expect(spec.paths["/v1/registry-entry-search"]).toBeDefined();
    expect(spec.paths["/v1/inbox-agent-registration-search"]).toBeDefined();
    expect(spec.paths["/v1/inbox-agent-registration"]).toBeUndefined();
  });

  it("keeps documented /api/v1 routes in sync with explicit route files", () => {
    const apiV1Root = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../app/api/v1",
    );
    const routeMethods = new Map<string, Set<string>>();

    for (const descriptor of proxyRouteDescriptors) {
      const methods = routeMethods.get(descriptor.normalizedPath) ?? new Set();
      methods.add(descriptor.method);
      routeMethods.set(descriptor.normalizedPath, methods);
    }

    routeMethods.set("inbox-agents", new Set(["GET", "POST"]));
    routeMethods.set("inbox-agents/[inboxAgentId]", new Set(["DELETE"]));
    routeMethods.set(
      "inbox-agents/[inboxAgentId]/deregister",
      new Set(["POST"]),
    );

    for (const [normalizedPath, methods] of routeMethods.entries()) {
      const routeFile = path.join(apiV1Root, normalizedPath, "route.ts");
      expect(existsSync(routeFile), `${routeFile} should exist`).toBe(true);

      const source = readFileSync(routeFile, "utf8");
      for (const method of methods) {
        expect(
          source.includes(`export async function ${method}(`),
          `${routeFile} should export ${method}`,
        ).toBe(true);
      }
    }
  });
});
