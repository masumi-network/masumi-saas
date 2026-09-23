import { describe, expect, it } from "vitest";

import {
  budgetOwnershipWhere,
  lowBalanceRuleOwnershipWhere,
  networkOwnershipWhere,
  paymentAttemptOwnershipWhere,
  resolveX402TenantScope,
} from "./tenant-scope.js";

const allowed = ["eip155:84532"];
describe("network scope query boundaries", () => {
  for (const [name, filter, field] of [
    ["budgets", budgetOwnershipWhere, "caip2Network"],
    ["networks", networkOwnershipWhere, "caip2Id"],
    ["attempts", paymentAttemptOwnershipWhere, "caip2Network"],
    ["rules", lowBalanceRuleOwnershipWhere, "caip2Network"],
  ] as const) {
    it(`restricts ${name} even when the caller has not selected a chain`, () => {
      const scope = resolveX402TenantScope({
        userId: "u",
        caip2NetworkLimit: allowed,
      } as Parameters<typeof resolveX402TenantScope>[0]);
      expect(filter(scope)).toMatchObject({
        AND: [{ [field]: { in: allowed } }],
      });
    });
  }
});
