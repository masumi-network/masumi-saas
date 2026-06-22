/**
 * E2E — Payment source / wallet-list compatibility (MAS-435)
 *
 * Guards the regression where GET /payment-source no longer embeds
 * PurchasingWallets/SellingWallets. Saas must parse the slim response and
 * hydrate wallets via GET /wallet/list when registration or inbox flows need them.
 *
 * Requires: running server at TEST_BASE_URL, DB, payment node with Preprod
 * payment source configured, and TEST_EMAIL/TEST_PASSWORD credentials.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { CookieJar, request, signIn, uniqueAgentName } from "../helpers";

let jar: CookieJar;

function assertNoPaymentSourceSchemaMismatch(body: unknown): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/PurchasingWallets/i);
  expect(serialized).not.toMatch(/SellingWallets/i);
  expect(serialized).not.toMatch(/ZodError/i);
  expect(serialized).not.toMatch(/expected array, received undefined/i);
}

beforeAll(async () => {
  jar = await signIn();
});

describe("E2E — Payment source schema compatibility", () => {
  it("GET /api/activity?filter=transactions resolves payment source without embedded wallets", async () => {
    const res = await request(
      "/api/activity?network=Preprod&filter=transactions",
      { jar },
    );

    expect(res.status).not.toBe(500);
    assertNoPaymentSourceSchemaMismatch(res.body);

    if (res.status === 503) {
      console.warn(
        "Skipping shape assertions — payment node or payment source not configured",
      );
      return;
    }

    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
    const data = b.data as Record<string, unknown>;
    expect(Array.isArray(data.items)).toBe(true);
  });

  it("GET /api/activity (all filters) returns 200 without payment-source parse errors", async () => {
    const res = await request("/api/activity?network=Preprod", { jar });

    expect(res.status).not.toBe(500);
    assertNoPaymentSourceSchemaMismatch(res.body);

    if (res.status === 503) {
      console.warn(
        "Skipping shape assertions — payment node or payment source not configured",
      );
      return;
    }

    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
  });

  it("POST /api/agents hydrates selling wallets via /wallet/list for registration", async () => {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: {
        name: uniqueAgentName("E2E-PaymentSource"),
        description: "MAS-435 payment-source wallet hydration test",
        apiUrl: "https://example.com/agent",
        tags: "e2e,payment-source",
      },
    });

    expect(res.status).not.toBe(500);
    assertNoPaymentSourceSchemaMismatch(res.body);

    const b = res.body as Record<string, unknown>;
    if (res.status === 200) {
      expect(b.success).toBe(true);
      expect(b.agentId).toBeTruthy();
      const data = b.data as Record<string, unknown>;
      expect(data.registrationState).toBe("RegistrationRequested");
      return;
    }

    // Funding wallet or payment-node config may be missing in some environments.
    expect([400, 503]).toContain(res.status);
    expect(b.success).toBe(false);
    expect(typeof b.error).toBe("string");
    expect(String(b.error)).not.toMatch(
      /Invalid input: expected array, received undefined/i,
    );
  });
});
