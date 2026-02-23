export const emailConfig = {
  postmarkServerId: process.env.POSTMARK_SERVER_ID,
  postmarkFromEmail:
    process.env.POSTMARK_FROM_EMAIL || "noreply@masumi.network",
} as const;
