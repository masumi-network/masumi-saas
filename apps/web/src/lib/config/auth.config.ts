const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const authEnvConfig = {
  baseUrl: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET!,
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET && {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }),
    ...(process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET && {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      }),
    ...(process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET && {
        microsoft: {
          clientId: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        },
      }),
    ...(process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_CLIENT_SECRET && {
        apple: {
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET,
        },
      }),
  },
} as const;

export const authConfig = {
  apiKey: {
    rateLimit: {
      enabled: true,
      timeWindow: parseInt(process.env.API_RATE_LIMIT_TIME_WINDOW || "60", 10),
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
    organizationLimit: parseInt(process.env.ORGANIZATION_LIMIT || "10", 10),
    invitationExpiresIn:
      parseInt(process.env.ORGANIZATION_INVITATION_EXPIRES_IN_DAYS || "7", 10) *
      DAY_IN_MS,
    cancelPendingInvitationsOnReInvite: true,
  },
  emailVerification: {
    expiresIn:
      parseInt(process.env.EMAIL_VERIFICATION_EXPIRES_IN_DAYS || "7", 10) *
      DAY_IN_MS,
  },
} as const;
