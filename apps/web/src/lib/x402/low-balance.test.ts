import { computeLowBalanceStatus } from "@masumi/payment-source-x402";
import { describe, expect, it } from "vitest";

describe("computeLowBalanceStatus", () => {
  it("marks balance below threshold as Low", () => {
    expect(computeLowBalanceStatus(BigInt(99), BigInt(100))).toBe("Low");
  });

  it("marks balance at or above threshold as Healthy", () => {
    expect(computeLowBalanceStatus(BigInt(100), BigInt(100))).toBe("Healthy");
    expect(computeLowBalanceStatus(BigInt(101), BigInt(100))).toBe("Healthy");
  });
});
