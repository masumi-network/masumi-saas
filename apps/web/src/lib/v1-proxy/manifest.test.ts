import { describe, expect, it } from "vitest";

import {
  buildProxyRouteManifest,
  getProxyRouteDescriptor,
  injectProxyRoutesIntoOpenApiDocument,
} from "./manifest";

describe("v1 proxy manifest", () => {
  it("includes generated payment and registry descriptors", () => {
    const registryRoute = getProxyRouteDescriptor("POST", "registry-entry");
    const paymentRoute = getProxyRouteDescriptor("POST", "payment");

    expect(registryRoute).toMatchObject({
      upstream: "registry",
      authMode: "registry-shared-token",
      upstreamPath: "/registry-entry/",
      openapiPath: "/v1/registry-entry",
    });
    expect(paymentRoute).toMatchObject({
      upstream: "payment",
      authMode: "payment-user-token",
      upstreamPath: "/payment",
      openapiPath: "/v1/payment",
    });
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
  });
});
