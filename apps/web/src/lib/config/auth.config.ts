const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const authConfig = {
  apiKey: {
    rateLimit: {
      enabled: true,
      timeWindow: parseInt(
        process.env.API_RATE_LIMIT_TIME_WINDOW || "60",
        10,
      ),
      maxRequests: parseInt(
        process.env.API_RATE_LIMIT_MAX_REQUESTS || "100",
        10,
      ),
    },
    enableMetadata: true,
  },
  organization: {
    invitationLimit: parseInt(
      process.env.ORGANIZATION_INVITATION_LIMIT || "100",
      10,
    ),
    organizationLimit: parseInt(
      process.env.ORGANIZATION_LIMIT || "10",
      10,
    ),
    invitationExpiresIn: parseInt(
      process.env.ORGANIZATION_INVITATION_EXPIRES_IN_DAYS || "7",
      10,
    ) * DAY_IN_MS,
    cancelPendingInvitationsOnReInvite: true,
  },
  emailVerification: {
    expiresIn: parseInt(
      process.env.EMAIL_VERIFICATION_EXPIRES_IN_DAYS || "7",
      10,
    ) * DAY_IN_MS,
  },
} as const;
