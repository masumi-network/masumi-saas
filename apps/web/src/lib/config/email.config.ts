import { authEnvConfig } from "@/lib/config/auth.config";

/** Default Masumi mark used in transactional emails when EMAIL_BRAND_LOGO_URL is unset. */
const DEFAULT_EMAIL_BRAND_LOGO_URL = `${authEnvConfig.baseUrl}/assets/logo.png`;

export const emailConfig = {
  postmarkServerId: process.env.POSTMARK_SERVER_ID,
  postmarkFromEmail:
    process.env.POSTMARK_FROM_EMAIL || "noreply@masumi.network",
  brandLogoUrl:
    process.env.EMAIL_BRAND_LOGO_URL?.trim() || DEFAULT_EMAIL_BRAND_LOGO_URL,
};
