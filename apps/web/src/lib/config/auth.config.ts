const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_APP_BASE_URL = "http://localhost:2999";

function readConfiguredUrl(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/\/+$/, "");
  return normalized ? normalized : null;
}

const publicBaseUrl =
  readConfiguredUrl(process.env.BETTER_AUTH_URL) ?? DEFAULT_APP_BASE_URL;

const magicLinkRateLimitMaxRaw =
  process.env.MAGIC_LINK_RATE_LIMIT_MAX ??
  process.env.MAGIC_LINK_ALLOWED_ATTEMPTS;

if (
  process.env.NODE_ENV === "development" &&
  process.env.MAGIC_LINK_ALLOWED_ATTEMPTS !== undefined &&
  process.env.MAGIC_LINK_RATE_LIMIT_MAX === undefined
) {
  console.warn(
    "[auth config] MAGIC_LINK_ALLOWED_ATTEMPTS is deprecated; use MAGIC_LINK_RATE_LIMIT_MAX (rateLimit.max for magic-link routes).",
  );
}

export const authEnvConfig = {
  baseUrl: publicBaseUrl,
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
  },
} as const;

function parsePositiveIntEnv(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = parseInt(value ?? String(fallback), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const EMAIL_OTP_EXPIRES_IN_MINUTES = Math.max(
  15,
  parsePositiveIntEnv(process.env.EMAIL_OTP_EXPIRES_IN_MINUTES, 15),
);

export const authConfig = {
  emailAndPassword: {
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
  },
  /** Six-digit codes: signup verification, magic-link email code, OIDC email verify. */
  emailOtp: {
    expiresInMinutes: EMAIL_OTP_EXPIRES_IN_MINUTES,
    expiresInSeconds: EMAIL_OTP_EXPIRES_IN_MINUTES * 60,
    allowedAttempts: parsePositiveIntEnv(
      process.env.EMAIL_OTP_ALLOWED_ATTEMPTS,
      3,
    ),
  },
  magicLink: {
    expiresIn:
      parseInt(process.env.MAGIC_LINK_EXPIRES_IN_MINUTES || "15", 10) * 60,
    rateLimit: {
      window: parseInt(process.env.MAGIC_LINK_RATE_LIMIT_WINDOW || "60", 10),
      max: parseInt(magicLinkRateLimitMaxRaw || "3", 10),
    },
  },
  apiKey: {
    /** Must match better-auth `apiKey({ defaultPrefix })` — used to detect API-key sessions vs cookies. */
    defaultKeyPrefix: "mas_",
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
