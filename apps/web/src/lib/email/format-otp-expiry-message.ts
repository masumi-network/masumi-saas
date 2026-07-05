import { authConfig } from "@/lib/config/auth.config";

/** Substitutes `{minutes}` using configured email OTP lifetime. */
export function formatOtpExpiryMessage(template: string): string {
  return template.replace(
    /\{minutes\}/g,
    String(authConfig.emailOtp.expiresInMinutes),
  );
}
