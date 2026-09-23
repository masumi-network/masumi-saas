import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  setBudget: vi.fn(),
  listPayments: vi.fn(),
  deleteBudget: vi.fn(),
}));
vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: mocks.auth,
  ForbiddenError: class extends Error {},
}));
vi.mock("@/lib/auth/org-admin", () => ({}));
vi.mock("@masumi/database/client", () => ({ default: {} }));
vi.mock("@masumi/payment-source-x402", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@masumi/payment-source-x402")>()),
  setX402WalletBudget: mocks.setBudget,
  listX402PaymentAttempts: mocks.listPayments,
  deleteX402WalletBudget: mocks.deleteBudget,
}));
vi.mock("@/lib/x402/chain-registry", () => ({}));
vi.mock("@/lib/x402/create-wallet", () => ({}));
vi.mock("@/lib/x402/wallet-custody-ops", () => ({}));
vi.mock("@/lib/x402/webhook-events", () => ({}));
vi.mock("@/lib/x402/resolve-api-key", () => ({
  requireX402ApiKeyIdForPay: async () => "key",
}));
vi.mock("@/lib/payment-node/resolve-payment-node-x402-network", () => ({}));
import { createApiApp } from "@/server/hono/app";

import { registerX402Routes } from "./register-routes";
const app = createApiApp("/api/v1/x402");
registerX402Routes(app);
describe("OIDC x402 network permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: { id: "u" },
      activeOrganizationId: null,
      authMethod: "oidcAccessToken",
      oidcScopes: ["payments:write:preprod", "payments:read:mainnet"],
    });
    mocks.listPayments.mockResolvedValue([]);
    mocks.deleteBudget.mockResolvedValue({
      budgetId: "budget",
      deletedAt: new Date(),
    });
  });
  it("rejects setting a mainnet budget with only mainnet read scope", async () => {
    const response = await app.request("/api/v1/x402/budgets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apiKeyId: "key",
        evmWalletId: "wallet",
        caip2Network: "eip155:8453",
        asset: "0x" + "1".repeat(40),
        remainingAmount: "1",
      }),
    });
    expect(response.status).toBe(401);
    expect(mocks.setBudget).not.toHaveBeenCalled();
  });
  it("restricts budget deletion to write networks", async () => {
    await app.request("/api/v1/x402/budgets", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ budgetId: "budget" }),
    });
    expect(mocks.deleteBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        caip2NetworkLimit: ["cardano:preprod", "eip155:84532"],
      }),
      "budget",
    );
  });
  it("applies read scopes to payment queries with no explicit network", async () => {
    mocks.auth.mockResolvedValue({
      user: { id: "u" },
      activeOrganizationId: null,
      authMethod: "oidcAccessToken",
      oidcScopes: ["payments:read:preprod"],
    });
    const response = await app.request("/api/v1/x402/payments");
    expect(response.status).toBe(200);
    expect(mocks.listPayments).toHaveBeenCalledWith(
      expect.objectContaining({
        caip2NetworkLimit: ["cardano:preprod", "eip155:84532"],
      }),
    );
  });
});
