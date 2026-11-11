import { describe, expect, it } from "vitest";

import { generateNumericOtp } from "./otp-code";

describe("generateNumericOtp", () => {
  it("returns only digits at the requested length, leading zeros kept", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateNumericOtp()).toMatch(/^\d{6}$/);
      expect(generateNumericOtp(8)).toMatch(/^\d{8}$/);
    }
  });
});
