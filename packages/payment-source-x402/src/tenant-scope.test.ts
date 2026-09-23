import { describe, expect, it } from "vitest";

import {
  budgetOwnershipWhere,
  networkOwnershipWhere,
  paymentAttemptOwnershipWhere,
  resolveX402TenantScope,
  walletOwnershipWhere,
} from "./tenant-scope.js";

describe("resolveX402TenantScope", () => {
  it("uses personal scope when organizationId is absent", () => {
    expect(resolveX402TenantScope({ userId: "user-1" })).toEqual({
      mode: "personal",
      userId: "user-1",
    });
  });

  it("uses org scope when organizationId is set", () => {
    expect(
      resolveX402TenantScope({ userId: "user-1", organizationId: "org-1" }),
    ).toEqual({
      mode: "org",
      userId: "user-1",
      organizationId: "org-1",
    });
  });
});

describe("ownership filters", () => {
  it("scopes wallets to org or personal tenant", () => {
    expect(
      walletOwnershipWhere({
        mode: "org",
        userId: "user-1",
        organizationId: "org-1",
      }),
    ).toEqual({ organizationId: "org-1", deletedAt: null });

    expect(
      walletOwnershipWhere({ mode: "personal", userId: "user-1" }),
    ).toEqual({ userId: "user-1", organizationId: null, deletedAt: null });
  });

  it("scopes networks to org or personal tenant", () => {
    expect(
      networkOwnershipWhere({
        mode: "org",
        userId: "user-1",
        organizationId: "org-1",
      }),
    ).toEqual({ organizationId: "org-1" });

    expect(
      networkOwnershipWhere({ mode: "personal", userId: "user-1" }),
    ).toEqual({ userId: "user-1", organizationId: null });
  });

  it("scopes payment attempts via network org for org workspaces", () => {
    expect(
      paymentAttemptOwnershipWhere({
        mode: "org",
        userId: "user-1",
        organizationId: "org-1",
      }),
    ).toEqual({ Network: { organizationId: "org-1" } });
  });

  it("scopes budgets via wallet org for org workspaces", () => {
    expect(
      budgetOwnershipWhere({
        mode: "org",
        userId: "user-1",
        organizationId: "org-1",
      }),
    ).toEqual({ EvmWallet: { organizationId: "org-1" } });
  });
});
