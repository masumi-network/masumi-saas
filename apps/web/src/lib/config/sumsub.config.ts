export const sumsubConfig = {
  appToken: process.env.SUMSUB_APP_TOKEN,
  secretKey: process.env.SUMSUB_SECRET_KEY,
  baseUrl: process.env.SUMSUB_BASE_URL || "https://api.sumsub.com",
  kycLevel: process.env.SUMSUB_KYC_LEVEL || "id-only",
  kybLevel: process.env.SUMSUB_KYB_LEVEL || "id-only",
} as const;
