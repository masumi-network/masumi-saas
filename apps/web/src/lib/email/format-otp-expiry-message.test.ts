import { describe, expect, it } from "vitest";

import { formatOtpExpiryMessage } from "./format-otp-expiry-message";

describe("formatOtpExpiryMessage", () => {
  it("substitutes configured OTP expiry minutes", () => {
    expect(formatOtpExpiryMessage("Expires in {minutes} minutes.")).toMatch(
      /Expires in \d+ minutes\./,
    );
    expect(
      formatOtpExpiryMessage("Expires in {minutes} minutes."),
    ).not.toContain("{minutes}");
  });
});
