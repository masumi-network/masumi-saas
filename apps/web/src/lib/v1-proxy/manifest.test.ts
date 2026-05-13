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

function hasMethodExport(source: string, method: string): boolean {
  return (
    new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`).test(
      source,
    ) ||
    new RegExp(`export\\s*\\{[^}]*\\b${method}\\b[^}]*\\}\\s*from`).test(source)
  );
}

describe("v1 proxy manifest", () => {
  it("includes generated payment and registry descriptors", () => {
    const registryRoute = getProxyRouteDescriptor("POST", "registry-entry");
    const registrySearchRoute = getProxyRouteDescriptor(
      "POST",
      "registry-entry-search",
    );
    const inboxBrowseRoute = getProxyRouteDescriptor(
      "POST",
      "inbox-agent-registration",
    );
    const inboxDiffRoute = getProxyRouteDescriptor(
      "POST",
      "inbox-agent-registration-diff",
    );
    const inboxSearchRoute = getProxyRouteDescriptor(
      "POST",
      "inbox-agent-registration-search",
    );
    const registrySourceRoute = getProxyRouteDescriptor(
      "GET",
      "registry-source",
    );
    const paymentRoute = getProxyRouteDescriptor("POST", "payment");

    expect(registryRoute).toMatchObject({
      upstream: "registry",
      authMode: "registry-shared-token",
      upstreamPath: "/registry-entry/",
      openapiPath: "/registry/api/v1/registry-entry",
    });
    expect(registrySearchRoute).toMatchObject({
      upstream: "registry",
      authMode: "registry-shared-token",
      upstreamPath: "/registry-entry-search/",
      openapiPath: "/registry/api/v1/registry-entry-search",
    });
    expect(inboxBrowseRoute).toMatchObject({
      upstream: "registry",
      authMode: "registry-shared-token",
      upstreamPath: "/inbox-agent-registration/",
      openapiPath: "/registry/api/v1/inbox-agent-registration",
    });
    expect(inboxDiffRoute).toMatchObject({
      upstream: "registry",
      authMode: "registry-shared-token",
      upstreamPath: "/inbox-agent-registration-diff/",
      openapiPath: "/registry/api/v1/inbox-agent-registration-diff",
    });
    expect(inboxSearchRoute).toMatchObject({
      upstream: "registry",
      authMode: "registry-shared-token",
      upstreamPath: "/inbox-agent-registration-search/",
      openapiPath: "/registry/api/v1/inbox-agent-registration-search",
    });
    expect(registrySourceRoute).toMatchObject({
      upstream: "registry",
      authMode: "registry-shared-token",
      upstreamPath: "/registry-source/",
      openapiPath: "/registry/api/v1/registry-source",
    });
    expect(paymentRoute).toMatchObject({
      upstream: "payment",
      authMode: "payment-user-token",
      upstreamPath: "/payment",
      openapiPath: "/pay/api/v1/payment",
    });
    expect(getProxyRouteDescriptor("GET", "registry-inbox")).toBeUndefined();
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

    const paymentPost = spec.paths["/pay/api/v1/payment"]?.post as
      | Record<string, unknown>
      | undefined;
    const registryEntryPost = spec.paths["/registry/api/v1/registry-entry"]
      ?.post as Record<string, unknown> | undefined;
    const inboxRegistrationPost = spec.paths[
      "/registry/api/v1/inbox-agent-registration"
    ]?.post as Record<string, unknown> | undefined;

    expect(registryEntryPost?.security).toStrictEqual([{ apiKeyHeader: [] }]);
    expect(registryEntryPost?.servers).toStrictEqual([
      { url: "/", description: "This app" },
    ]);
    expect(paymentPost?.security).toStrictEqual([{ apiKeyHeader: [] }]);
    expect(paymentPost?.servers).toStrictEqual([
      { url: "/", description: "This app" },
    ]);
    expect(paymentPost?.responses).toMatchObject({
      402: {
        description: "Insufficient credits",
      },
    });
    expect(
      (registryEntryPost?.responses as Record<string, unknown>)?.["402"],
    ).toBe(undefined);
    expect(inboxRegistrationPost).toBeDefined();
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
    expect(spec.paths["/v1/registry-entry"]).toBeUndefined();
    expect(spec.paths["/v1/payment"]).toBeUndefined();
    expect(spec.paths["/registry/api/v1/registry-entry-search"]).toBeDefined();
    expect(
      spec.paths["/registry/api/v1/inbox-agent-registration-search"],
    ).toBeDefined();
    expect(
      spec.paths["/registry/api/v1/inbox-agent-registration"],
    ).toBeDefined();
    expect(
      spec.paths["/registry/api/v1/inbox-agent-registration-diff"],
    ).toBeDefined();
    expect(spec.paths["/registry/api/v1/registry-source"]).toBeDefined();
  });

  it("keeps documented /api/v1 routes in sync with explicit route files", () => {
    const appRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../app",
    );
    const routeMethods = new Map<string, Set<string>>();

    for (const descriptor of proxyRouteDescriptors) {
      const routeKey = descriptor.saasPath.replace(/^\/+/, "");
      const methods = routeMethods.get(routeKey) ?? new Set();
      methods.add(descriptor.method);
      routeMethods.set(routeKey, methods);
    }

    routeMethods.set("pay/api/v1/inbox-agents", new Set(["GET", "POST"]));
    routeMethods.set(
      "pay/api/v1/inbox-agents/[inboxAgentId]",
      new Set(["DELETE"]),
    );
    routeMethods.set(
      "pay/api/v1/inbox-agents/[inboxAgentId]/deregister",
      new Set(["POST"]),
    );
    routeMethods.set(
      "pay/api/v1/registry-inbox/agent-identifier",
      new Set(["GET"]),
    );

    for (const [routeKey, methods] of routeMethods.entries()) {
      const routeFile = path.join(appRoot, routeKey, "route.ts");
      expect(existsSync(routeFile), `${routeFile} should exist`).toBe(true);

      const source = readFileSync(routeFile, "utf8");
      for (const method of methods) {
        expect(
          hasMethodExport(source, method),
          `${routeFile} should export ${method}`,
        ).toBe(true);
      }
    }
  });
});
