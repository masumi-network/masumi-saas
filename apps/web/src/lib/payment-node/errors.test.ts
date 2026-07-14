import { describe, expect, it } from "vitest";

import { ApiError } from "@/server/hono/errors";

import { rethrowPaymentNodeClientError } from "./errors";

describe("rethrowPaymentNodeClientError", () => {
  it("maps payment-node status-prefixed errors to ApiError", () => {
    expect(() =>
      rethrowPaymentNodeClientError(
        new Error(
          "402: Managed wallet has insufficient on-chain balance for this payment",
        ),
      ),
    ).toThrow(ApiError);

    try {
      rethrowPaymentNodeClientError(
        new Error(
          "402: Managed wallet has insufficient on-chain balance for this payment",
        ),
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(402);
      expect((error as ApiError).message).toContain("insufficient on-chain");
    }
  });

  it("rethrows unknown errors unchanged", () => {
    const err = new Error("network timeout");
    expect(() => rethrowPaymentNodeClientError(err)).toThrow(err);
  });
});
