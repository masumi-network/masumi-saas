import { randomInt } from "node:crypto";

const OTP_DEFAULT_LENGTH = 6;
const DECIMAL_DIGITS = 10;

/**
 * Numeric one-time code for email verification and sign-in. Uses the CSPRNG:
 * the code is a credential, so it must not be predictable.
 */
export function generateNumericOtp(length = OTP_DEFAULT_LENGTH): string {
  return Array.from({ length }, () => randomInt(DECIMAL_DIGITS)).join("");
}
