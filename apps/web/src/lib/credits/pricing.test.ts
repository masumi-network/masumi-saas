import { describe, expect, it } from "vitest";

import { formatCreditAmount as formatFromModule } from "@/lib/credits/format";
import {
  atomicCreditsToDisplayUnits,
  CREDIT_OPERATION_COST_ATOMIC,
  CREDITS_PER_PAYMENT_EVENT,
  getCreditCostForReason,
  INITIAL_CREDIT_GRANT_ATOMIC,
} from "@/lib/credits/pricing";

describe("credit pricing", () => {
  it("uses 800 atomic units per payment proxy write", () => {
    expect(CREDITS_PER_PAYMENT_EVENT).toBe(800);
    expect(getCreditCostForReason("payment_proxy_write")).toBe(800);
  });

  it("charges less for agent and inbox registration", () => {
    expect(CREDIT_OPERATION_COST_ATOMIC.agent_register).toBe(400);
    expect(CREDIT_OPERATION_COST_ATOMIC.inbox_agent_register).toBe(400);
  });

  it("grants twenty payment-units on signup", () => {
    expect(INITIAL_CREDIT_GRANT_ATOMIC).toBe(20 * 800);
  });

  it("formats atomic balances as display units", () => {
    expect(atomicCreditsToDisplayUnits(16000)).toBe(20);
    expect(formatFromModule(16000)).toBe("20");
    expect(formatFromModule(400)).toBe("0.5");
  });
});
