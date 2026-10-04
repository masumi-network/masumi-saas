import { describe, expect, it } from "vitest";

import { formatPaymentNodeResponseError } from "./format-response-error";

describe("formatPaymentNodeResponseError", () => {
  it("reads nested error.message from payment node bodies", () => {
    expect(
      formatPaymentNodeResponseError(
        { error: { message: "Agent identifier not found" } },
        "fallback",
      ),
    ).toBe("Agent identifier not found");
  });

  it("reads string error field", () => {
    expect(
      formatPaymentNodeResponseError({ error: "Forbidden" }, "fallback"),
    ).toBe("Forbidden");
  });

  it("falls back when shape is unknown", () => {
    expect(formatPaymentNodeResponseError({}, "Bad Request")).toBe(
      "Bad Request",
    );
  });
});
