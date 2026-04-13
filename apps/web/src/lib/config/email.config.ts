/** Default Masumi mark used in transactional emails when EMAIL_BRAND_LOGO_URL is unset. */
const DEFAULT_EMAIL_BRAND_LOGO_URL =
  "https://avatars.githubusercontent.com/u/194367856?s=200&v=4";

export const emailConfig = {
  postmarkServerId: process.env.POSTMARK_SERVER_ID,
  postmarkFromEmail:
    process.env.POSTMARK_FROM_EMAIL || "noreply@masumi.network",
  brandLogoUrl:
    process.env.EMAIL_BRAND_LOGO_URL?.trim() || DEFAULT_EMAIL_BRAND_LOGO_URL,
};
