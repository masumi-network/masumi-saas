import "server-only";

import { apiKey } from "@better-auth/api-key";
import {
  oauthDeviceAuthorization,
  oauthProvider,
} from "@better-auth/oauth-provider";
import prisma from "@masumi/database/client";
import { APIError, betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import {
  admin,
  bearer,
  emailOTP,
  jwt,
  magicLink,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { localization } from "better-auth-localization";

import { adminImpersonationGuardPlugin } from "@/lib/auth/admin-impersonation-guard";
import {
  enforceEmailSendRateLimit,
  sendMagicLinkEmail,
  sendOrganizationInvitationEmail,
  sendResetPasswordEmail,
  sendVerificationLinkEmail,
  sendVerificationOtpEmail,
} from "@/lib/auth/auth-emails";
import {
  createEmailOtpStoreOptions,
  createMagicLinkTokenHasher,
  securePrismaAuthAdapter,
} from "@/lib/auth/auth-storage";
import { getBootstrapAdminIds } from "@/lib/auth/config";
import { displayNameFromEmail } from "@/lib/auth/display-name-from-email";
import { resetEmailSendLimit } from "@/lib/auth/email-send-rate-limit";
import { masumiOidcPolicy } from "@/lib/auth/oidc/policy-plugin";
import {
  oidcJwtPluginOptions,
  oidcProviderOptions,
} from "@/lib/auth/oidc/provider-config";
import {
  ACCOUNT_SOFT_DELETED_MESSAGE,
  assertUserIsNotSoleOrgOwner,
  softDeleteUserAccount,
} from "@/lib/auth/soft-delete-account";
import { authConfig, authEnvConfig } from "@/lib/config/auth.config";
import { getTrustedOidcOrigins, oidcEnvConfig } from "@/lib/config/oidc.config";
import { grantInitialCreditsIfNeeded } from "@/lib/credits/service";
import { createPaymentNodeKeyForUser } from "@/lib/payment-node/on-signup";

export const auth = betterAuth({
  disabledPaths: ["/token"],
  appName: "Masumi",
  database: securePrismaAuthAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: authEnvConfig.secret,
  baseURL: authEnvConfig.baseUrl,
  trustedOrigins: [
    authEnvConfig.baseUrl,
    oidcEnvConfig.issuer,
    ...getTrustedOidcOrigins(),
    ...(process.env.NODE_ENV === "production"
      ? []
      : [
          "http://localhost:2999",
          "http://127.0.0.1:2999",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
          "http://localhost:3010",
          "http://127.0.0.1:3010",
        ]),
    ...(process.env.NETWORK_SITE_URL?.trim()
      ? [process.env.NETWORK_SITE_URL.trim()]
      : []),
  ],
  advanced: {
    // In production we force secure cookies on regardless of BETTER_AUTH_URL.
    // Prod deployments always run behind TLS; if BETTER_AUTH_URL were
    // misconfigured (missing, http://, or no scheme) we'd silently drop the
    // `__Secure-` prefix and Secure flag on session cookies, and WebKit/
    // Safari/Brave would reject them on the OIDC cross-site redirect.
    useSecureCookies:
      process.env.NODE_ENV === "production" ||
      authEnvConfig.baseUrl.startsWith("https://"),
    defaultCookieAttributes: {
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production" ||
        authEnvConfig.baseUrl.startsWith("https://"),
      httpOnly: true,
      path: "/",
    },
  },
  account: {
    encryptOAuthTokens: true,
  },
  emailAndPassword: {
    enabled: true,
    // Allow unverified users to sign in; we enforce verification at the action level instead
    requireEmailVerification: false,
    autoSignIn: true,
    sendResetPassword: sendResetPasswordEmail,
  },
  socialProviders: authEnvConfig.socialProviders,
  emailVerification: {
    sendVerificationEmail: sendVerificationLinkEmail,
    sendOnSignUp: true,
    sendOnSignIn: true,
    expiresIn: authConfig.emailVerification.expiresIn,
    autoSignInAfterVerification: true,
  },
  user: {
    additionalFields: {
      onboardingCompleted: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: true,
      },
    },
    changeEmail: {
      enabled: true,
    },
    deleteUser: {
      enabled: true,
      // Soft delete: Better Auth verifies the password before this hook, then we
      // disable the account (ban + revoke API keys + sessions) and abort the
      // hard delete by throwing, so the row and all its financial/audit data are
      // retained. `deleteAccountAction` treats this sentinel as success.
      beforeDelete: async (user) => {
        // Refuse if the user is the sole owner of any org (throws a user-facing
        // message; nothing is disabled yet).
        await assertUserIsNotSoleOrgOwner(user.id);
        await softDeleteUserAccount(user.id);
        throw new APIError("BAD_REQUEST", {
          message: ACCOUNT_SOFT_DELETED_MESSAGE,
        });
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (!user.name?.trim()) {
            try {
              await prisma.user.update({
                where: { id: user.id },
                data: { name: displayNameFromEmail(user.email) },
              });
            } catch (error) {
              console.error(
                "[auth] Failed to backfill display name for new user",
                user.id,
                error,
              );
            }
          }
          if (user.emailVerified) {
            await grantInitialCreditsIfNeeded(user.id);
          }
          await createPaymentNodeKeyForUser(user.id);
        },
      },
      update: {
        after: async (user) => {
          // Registration confirmation is "successful" the moment the user's
          // email becomes verified — clear the per-email send counter so a
          // legitimate user whose session is cycling isn't blocked.
          if (user.emailVerified) {
            try {
              await resetEmailSendLimit(user.email);
            } catch (error) {
              console.error(
                "[auth] Failed to reset email send rate limit",
                user.id,
                error,
              );
            }
            try {
              await grantInitialCreditsIfNeeded(user.id);
            } catch (error) {
              console.error(
                "[auth] Failed to grant initial credits",
                user.id,
                error,
              );
            }
          }
        },
      },
    },
  },
  plugins: [
    jwt(oidcJwtPluginOptions),
    oauthProvider(oidcProviderOptions),
    oauthDeviceAuthorization({
      verificationUri: oidcEnvConfig.deviceVerificationUri,
    }),
    masumiOidcPolicy(),
    emailOTP({
      expiresIn: authConfig.emailOtp.expiresInSeconds,
      otpLength: 6,
      allowedAttempts: authConfig.emailOtp.allowedAttempts,
      storeOTP: createEmailOtpStoreOptions(),
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "email-verification") {
          return;
        }

        await enforceEmailSendRateLimit(email);
        await sendVerificationOtpEmail({ email, otp });
      },
    }),
    bearer(),
    magicLink({
      expiresIn: authConfig.magicLink.expiresIn,
      rateLimit: authConfig.magicLink.rateLimit,
      storeToken: createMagicLinkTokenHasher(),
      sendMagicLink: sendMagicLinkEmail,
    }),
    twoFactor({
      issuer: "Masumi",
      skipVerificationOnEnable: false,
    }),
    adminImpersonationGuardPlugin,
    admin({
      defaultRole: "user",
      adminUserIds: getBootstrapAdminIds(),
    }),
    apiKey({
      defaultPrefix: authConfig.apiKey.defaultKeyPrefix,
      disableKeyHashing: false,
      startingCharactersConfig: {
        shouldStore: true,
        charactersLength: 12,
      },
      rateLimit: authConfig.apiKey.rateLimit,
      enableMetadata: authConfig.apiKey.enableMetadata,
      enableSessionForAPIKeys: true,
      customAPIKeyGetter: (ctx) => {
        // When getSession({ headers }) is used (e.g. from API routes), context has ctx.headers, not ctx.request
        const headers = ctx.request?.headers ?? ctx.headers;
        if (!headers) return null;
        const xApiKey = headers.get("x-api-key");
        if (xApiKey) return xApiKey;
        const authHeader = headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return null;
        const token = authHeader.slice(7).trim();
        if (token.startsWith(authConfig.apiKey.defaultKeyPrefix)) return token;
        return null;
      },
    }),
    organization({
      // Soft-delete policy: organizations are never hard-deleted (which would
      // cascade/SetNull their x402 networks & wallets and can collide with the
      // personal-scope unique indexes). Disable Better Auth's hard-delete
      // endpoint; a soft org-delete flow can be added if/when needed.
      disableOrganizationDeletion: true,
      organizationCreation: {
        afterCreate: async () => {
          // Organization post-creation logic (e.g., Stripe customer setup)
        },
      },
      schema: {
        organization: {
          additionalFields: {
            stripeCustomerId: {
              type: "string",
              required: false,
              defaultValue: null,
              input: false,
            },
            invoiceEmail: {
              type: "string",
              required: false,
              defaultValue: null,
              input: false,
            },
          },
        },
      },
      sendInvitationEmail: sendOrganizationInvitationEmail,
      invitationLimit: authConfig.organization.invitationLimit,
      cancelPendingInvitationsOnReInvite:
        authConfig.organization.cancelPendingInvitationsOnReInvite,
      allowUserToCreateOrganization(user) {
        return (
          !authConfig.emailAndPassword.requireEmailVerification ||
          !!user.emailVerified
        );
      },
      organizationLimit: authConfig.organization.organizationLimit,
      invitationExpiresIn: authConfig.organization.invitationExpiresIn,
    }),
    localization({
      defaultLocale: "default",
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = typeof auth.$Infer.Session.user;
export type Invitation = typeof auth.$Infer.Invitation;
