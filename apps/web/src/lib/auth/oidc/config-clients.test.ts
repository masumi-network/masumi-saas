import { describe, expect, it, vi } from "vitest";

import {
  buildConfigOidcClientRow,
  createConfigClientDiscovery,
  isConfigOidcClientRowCurrent,
} from "./config-clients";

const DEVICE_CODE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

describe("buildConfigOidcClientRow", () => {
  it("makes the CLI a native public client with the device grant and no consent screen", () => {
    const row = buildConfigOidcClientRow("cli");
    expect(row).toMatchObject({
      applicationType: "native",
      tokenEndpointAuthMethod: "none",
      requirePKCE: true,
      skipConsent: true,
    });
    expect(row.grantTypes).toContain(DEVICE_CODE_GRANT);
  });

  it("keeps the web client on authorization_code with consent", () => {
    const row = buildConfigOidcClientRow("web");
    expect(row.skipConsent).toBe(false);
    expect(row.grantTypes).not.toContain(DEVICE_CODE_GRANT);
    expect(row.scopes).toEqual(
      expect.arrayContaining(["openid", "profile", "email", "offline_access"]),
    );
  });
});

describe("isConfigOidcClientRowCurrent", () => {
  const desired = buildConfigOidcClientRow("web");

  it("accepts a stored row whose metadata came back parsed", () => {
    expect(
      isConfigOidcClientRowCurrent(
        { ...desired, metadata: JSON.parse(desired.metadata) },
        desired,
      ),
    ).toBe(true);
  });

  it("detects a changed scope list", () => {
    expect(
      isConfigOidcClientRowCurrent(
        { ...desired, scopes: desired.scopes.slice(1) },
        desired,
      ),
    ).toBe(false);
  });
});

describe("createConfigClientDiscovery", () => {
  function contextWith(adapter: Record<string, unknown>) {
    return { context: { adapter } } as never;
  }

  it("re-reads the row when a concurrent create wins the unique-key race", async () => {
    const winner = { ...buildConfigOidcClientRow("cli"), id: "row-1" };
    const adapter = {
      create: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error(), { code: "P2002" })),
      findOne: vi.fn().mockResolvedValue(winner),
    };
    const discovery = createConfigClientDiscovery();

    const resolved = await discovery.resolve(
      contextWith(adapter),
      winner.clientId,
      null,
    );

    expect(resolved).toBe(winner);
  });

  it("rethrows other create failures", async () => {
    const adapter = {
      create: vi.fn().mockRejectedValue(new Error("db down")),
      findOne: vi.fn(),
    };
    const discovery = createConfigClientDiscovery();

    await expect(
      discovery.resolve(
        contextWith(adapter),
        buildConfigOidcClientRow("cli").clientId,
        null,
      ),
    ).rejects.toThrow("db down");
  });

  it("does not write when the stored row already matches config", async () => {
    const existing = { ...buildConfigOidcClientRow("web"), id: "row-1" };
    const adapter = { update: vi.fn(), create: vi.fn() };
    const discovery = createConfigClientDiscovery();

    await discovery.resolve(
      contextWith(adapter),
      existing.clientId,
      existing as never,
    );

    expect(adapter.update).not.toHaveBeenCalled();
    expect(adapter.create).not.toHaveBeenCalled();
  });
});
