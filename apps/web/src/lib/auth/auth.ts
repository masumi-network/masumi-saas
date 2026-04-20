import "server-only";

import prisma from "@masumi/database/client";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, betterAuth } from "better-auth";
import { getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import {
  admin,
  apiKey,
  bearer,
  createAuthMiddleware,
  deviceAuthorization,
  emailOTP,
  jwt,
  magicLink,
  oidcProvider,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { localization } from "better-auth-localization";
import { headers } from "next/headers";

import {
  buildStoredOtpValue,
  createEmailOtpStoreOptions,
  createMagicLinkTokenHasher,
  createVerificationValue,
  deleteVerificationByIdentifier,
  securePrismaAuthAdapter,
} from "@/lib/auth/auth-storage";
import { getBootstrapAdminIds } from "@/lib/auth/config";
import { displayNameFromEmail } from "@/lib/auth/display-name-from-email";
import {
  checkAndIncrementEmailSendLimit,
  EMAIL_SEND_RATE_LIMIT_MAX_ATTEMPTS,
  EMAIL_SEND_RATE_LIMIT_WINDOW_MS,
  resetEmailSendLimit,
} from "@/lib/auth/email-send-rate-limit";
import { isOidcMagicLinkCallbackUrl } from "@/lib/auth/magic-link-callback";
import { authConfig, authEnvConfig } from "@/lib/config/auth.config";
import { emailConfig, getPostmarkFromHeader } from "@/lib/config/email.config";
import {
  getPublicOidcMetadata,
  getTrustedOidcClients,
  getTrustedOidcOrigins,
  OIDC_ID_TOKEN_SIGNING_ALG,
  oidcEnvConfig,
} from "@/lib/config/oidc.config";
import { OIDC_API_SCOPES } from "@/lib/config/oidc-scopes.config";
import { PRIVACY_POLICY_URL } from "@/lib/config/privacy-policy-url";
import { grantInitialCreditsIfNeeded } from "@/lib/credits/service";
import { reactAgentMessengerMagicLinkEmail } from "@/lib/email/agent-messenger-magic-link";
import { reactInvitationEmail } from "@/lib/email/invitation";
import { reactMagicLinkEmail } from "@/lib/email/magic-link";
import { getEmailMessages, parseAcceptLanguage } from "@/lib/email/messages";
import { postmarkClient } from "@/lib/email/postmark";
import { reactResetPasswordEmail } from "@/lib/email/reset-password";
import { reactVerificationEmail } from "@/lib/email/verification";
import { reactVerificationCodeEmail } from "@/lib/email/verification-code";
import { createPaymentNodeKeyForUser } from "@/lib/payment-node/on-signup";

const EMAIL_OTP_EXPIRES_IN_SECONDS = 5 * 60;
const EMAIL_OTP_ALLOWED_ATTEMPTS = 3;
const ADMIN_IMPERSONATION_TARGET_ERROR = "Admin users cannot be impersonated.";

function isAdminImpersonationTarget(user: {
  id: string;
  role?: string | null;
}): boolean {
  return user.role === "admin" || getBootstrapAdminIds().includes(user.id);
}

const adminImpersonationGuardPlugin = {
  id: "admin-impersonation-guard",
  hooks: {
    before: [
      {
        matcher(context) {
          return context.path === "/admin/impersonate-user";
        },
        handler: createAuthMiddleware(async (ctx) => {
          const currentSession = await getSessionFromCtx(ctx);
          if (
            !currentSession?.user ||
            !isAdminImpersonationTarget(currentSession.user)
          ) {
            return;
          }

          const targetUserId =
            typeof ctx.body?.userId === "string"
              ? ctx.body.userId
              : ctx.body?.userId != null
                ? String(ctx.body.userId)
                : null;

          if (!targetUserId) {
            return;
          }

          const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, role: true },
          });

          if (!targetUser || !isAdminImpersonationTarget(targetUser)) {
            return;
          }

          throw new APIError("FORBIDDEN", {
            message: ADMIN_IMPERSONATION_TARGET_ERROR,
          });
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;

/**
 * Caps how many auth emails (magic-link + verification codes) any single
 * email address can receive per rolling window. The counter is reset when
 * the recipient either successfully redeems a magic-link code or verifies
 * their email address.
 */
async function enforceEmailSendRateLimit(email: string): Promise<void> {
  const result = await checkAndIncrementEmailSendLimit(email);
  if (result.allowed) {
    return;
  }

  const retryAfterMinutes = Math.max(
    1,
    Math.ceil(result.retryAfterSeconds / 60),
  );
  throw new APIError("TOO_MANY_REQUESTS", {
    message: `Too many email requests. Please try again in ${retryAfterMinutes} minute(s). Max ${EMAIL_SEND_RATE_LIMIT_MAX_ATTEMPTS} emails per ${Math.round(EMAIL_SEND_RATE_LIMIT_WINDOW_MS / 60000)} minutes.`,
    code: "TOO_MANY_EMAIL_REQUESTS",
  });
}

function generateEmailVerificationCode(length = 6): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

type EmailOtpType = "email-verification" | "sign-in";

function logDevCode(label: string, email: string, otp: string) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.log(`\n[DEV] ${label}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`To: ${email}`);
  console.log(`Verification Code: ${otp}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

async function createEmailOtp(
  email: string,
  type: EmailOtpType,
): Promise<string> {
  const identifier = `${type}-otp-${email.toLowerCase()}`;
  const otp = generateEmailVerificationCode();

  await deleteVerificationByIdentifier(identifier);

  await createVerificationValue({
    id: crypto.randomUUID(),
    identifier,
    value: buildStoredOtpValue(otp),
    expiresAt: new Date(Date.now() + EMAIL_OTP_EXPIRES_IN_SECONDS * 1000),
  });

  return otp;
}

async function createEmailVerificationOtp(email: string): Promise<string> {
  return await createEmailOtp(email, "email-verification");
}

async function createMagicLinkOtp(email: string): Promise<string> {
  return await createEmailOtp(email, "sign-in");
}

async function sendVerificationOtpEmail({
  email,
  otp,
}: {
  email: string;
  otp: string;
}) {
  if (process.env.NODE_ENV === "development") {
    logDevCode("Email verification code", email, otp);
    if (!postmarkClient) {
      console.log(
        "Tip: Set POSTMARK_SERVER_ID in your .env to send real emails\n",
      );
      return;
    }
  }

  if (!postmarkClient) {
    console.error("Postmark not configured. Email verification OTP failed.", {
      to: email,
    });
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Failed to send verification code. Please try again.",
    });
  }

  const headersList = await headers();
  const locale = parseAcceptLanguage(headersList.get("accept-language"));
  const msg = getEmailMessages(locale).VerificationCode;

  await postmarkClient.sendEmail({
    From: getPostmarkFromHeader("verification"),
    To: email,
    Tag: "verification-code",
    Subject: msg.preview,
    HtmlBody: await reactVerificationCodeEmail({
      name: displayNameFromEmail(email),
      otpCode: otp,
      translations: {
        preview: msg.preview,
        title: msg.title,
        greeting: msg.greeting,
        message: msg.message,
        codeLabel: msg.codeLabel,
        expiry: msg.expiry,
        footer: msg.footer,
      },
    }),
    MessageStream: "outbound",
  });
}

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
      : ["http://localhost:2999", "http://127.0.0.1:2999"]),
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
    sendResetPassword: async ({ user, url }) => {
      if (!postmarkClient) {
        if (process.env.NODE_ENV === "development") {
          console.log("\n[DEV] Password reset email (Postmark not configured)");
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.log(`To: ${user.email}`);
          console.log(`Reset Link: ${url}`);
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.log(
            "Tip: Set POSTMARK_SERVER_ID in your .env to send real emails\n",
          );
        } else {
          console.error(
            "Postmark not configured. Password reset email failed.",
            { to: user.email },
          );
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Failed to send password reset email. Please try again.",
          });
        }
        return;
      }

      const headersList = await headers();
      const locale = parseAcceptLanguage(headersList.get("accept-language"));
      const msg = getEmailMessages(locale);

      await postmarkClient.sendEmail({
        From: getPostmarkFromHeader("passwordReset"),
        To: user.email,
        Tag: "reset-password",
        Subject: msg.ResetPassword.preview,
        HtmlBody: await reactResetPasswordEmail({
          name: user.name || "User",
          resetLink: url,
          translations: {
            preview: msg.ResetPassword.preview,
            title: msg.ResetPassword.title,
            greeting: msg.ResetPassword.greeting,
            message: msg.ResetPassword.message,
            button: msg.ResetPassword.button,
            footer: msg.ResetPassword.footer,
          },
        }),
        MessageStream: "outbound",
      });
    },
  },
  socialProviders: authEnvConfig.socialProviders,
  emailVerification: {
    sendVerificationEmail: async ({ user, url }, request) => {
      const isResend =
        typeof request?.url === "string" &&
        request.url.includes("send-verification-email");
      await enforceEmailSendRateLimit(user.email);
      const verificationCode = await createEmailVerificationOtp(user.email);

      if (process.env.NODE_ENV === "development") {
        console.log("\n[DEV] Email verification link");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`To: ${user.email}`);
        console.log(`Verification Link: ${url}`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        logDevCode("Email verification code", user.email, verificationCode);
      }

      if (!postmarkClient) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            "Tip: Set POSTMARK_SERVER_ID in your .env to send real emails\n",
          );
          return;
        }
        console.error("Postmark not configured. Email verification failed.", {
          to: user.email,
        });
        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: "Failed to send verification email. Please try again.",
        });
      }

      const headersList = await headers();
      const locale = parseAcceptLanguage(headersList.get("accept-language"));
      const msg = getEmailMessages(locale).Verification;

      try {
        await postmarkClient.sendEmail({
          From: getPostmarkFromHeader("verification"),
          To: user.email,
          Tag: "verification-email",
          Subject: msg.preview,
          HtmlBody: await reactVerificationEmail({
            name: user.name || "User",
            verificationLink: url,
            verificationCode,
            logoUrl: emailConfig.brandLogoUrl,
            translations: {
              preview: msg.preview,
              title: msg.title,
              greeting: msg.greeting,
              message: msg.message,
              button: msg.button,
              codeLabel: msg.codeLabel,
              codeExpiry: msg.codeExpiry,
              codeHelp: msg.codeHelp,
              footer: msg.footer,
            },
          }),
          MessageStream: "outbound",
        });
      } catch (err) {
        console.error("[Postmark] Verification email failed:", err);
        if (isResend) {
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Failed to send verification email. Please try again.",
          });
        }
        if (process.env.NODE_ENV === "development") {
          console.log("[DEV] Verification link (Postmark failed):", url);
        }
      }
    },
    sendOnSignUp: true,
    sendOnSignIn: true,
    expiresIn: authConfig.emailVerification.expiresIn,
    autoSignInAfterVerification: true,
  },
  user: {
    changeEmail: {
      enabled: true,
    },
    deleteUser: {
      enabled: true,
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
    jwt({
      jwt: {
        issuer: oidcEnvConfig.issuer,
      },
      jwks: {
        keyPairConfig: {
          alg: OIDC_ID_TOKEN_SIGNING_ALG,
        },
      },
    }),
    oidcProvider({
      loginPage: "/signin",
      consentPage: "/oidc/consent",
      useJWTPlugin: true,
      requirePKCE: true,
      storeClientSecret: "hashed",
      scopes: OIDC_API_SCOPES,
      trustedClients: getTrustedOidcClients(),
      metadata: getPublicOidcMetadata(),
      getAdditionalUserInfoClaim: async (user, scopes) => {
        if (!scopes.includes("profile")) return {};

        return {
          picture: user.image || undefined,
        };
      },
    }),
    deviceAuthorization({
      verificationUri: oidcEnvConfig.deviceVerificationUri,
      validateClient: async (clientId) =>
        clientId === oidcEnvConfig.cli.clientId,
    }),
    emailOTP({
      expiresIn: EMAIL_OTP_EXPIRES_IN_SECONDS,
      otpLength: 6,
      allowedAttempts: EMAIL_OTP_ALLOWED_ATTEMPTS,
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
      sendMagicLink: async ({ email, url }, ctx) => {
        await enforceEmailSendRateLimit(email);
        const requestedName =
          typeof ctx?.body?.name === "string" && ctx.body.name.trim().length > 0
            ? ctx.body.name.trim()
            : null;
        const callbackUrl =
          typeof ctx?.body?.callbackURL === "string"
            ? ctx.body.callbackURL
            : typeof ctx?.body?.newUserCallbackURL === "string"
              ? ctx.body.newUserCallbackURL
              : undefined;
        const isOidcMagicLink = isOidcMagicLinkCallbackUrl(callbackUrl);
        const existingUser = await prisma.user.findUnique({
          where: { email },
          select: { name: true },
        });
        const name =
          existingUser?.name?.trim() ||
          requestedName ||
          displayNameFromEmail(email);
        const magicCode = await createMagicLinkOtp(email);

        if (!postmarkClient) {
          if (process.env.NODE_ENV === "development") {
            console.log("\n[DEV] Magic link email (Postmark not configured)");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log(`To: ${email}`);
            console.log(`Magic Link: ${url}`);
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            logDevCode("Magic link sign-in code", email, magicCode);
            console.log(
              "Tip: Set POSTMARK_SERVER_ID in your .env to send real emails\n",
            );
            return;
          }
          console.error("Postmark not configured. Magic link email failed.", {
            to: email,
          });
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Failed to send magic link. Please try again.",
          });
        }

        const headersList = await headers();
        const locale = parseAcceptLanguage(headersList.get("accept-language"));
        const emailMessages = getEmailMessages(locale);
        const msg = isOidcMagicLink
          ? emailMessages.MagicLinkOidc
          : emailMessages.MagicLink;

        try {
          if (process.env.NODE_ENV === "development") {
            logDevCode("Magic link sign-in code", email, magicCode);
          }

          const htmlBody = isOidcMagicLink
            ? await reactAgentMessengerMagicLinkEmail({
                name,
                magicLink: url,
                magicCode,
                logoUrl: emailConfig.agentMessengerLogoUrl,
                poweredByLogoUrl: emailConfig.brandLogoUrl,
                includePrivacyConsent: !existingUser,
                privacyPolicyUrl: PRIVACY_POLICY_URL,
                translations: {
                  preview: msg.preview,
                  title: msg.title,
                  greeting: msg.greeting,
                  message: msg.message,
                  consentBefore: msg.consentBefore,
                  consentPrivacyLabel: msg.consentPrivacyLabel,
                  consentAfter: msg.consentAfter,
                  button: msg.button,
                  codeLabel: msg.codeLabel,
                  codeExpiry: msg.codeExpiry,
                  codeHelp: msg.codeHelp,
                  footer: msg.footer,
                },
              })
            : await reactMagicLinkEmail({
                name,
                magicLink: url,
                magicCode,
                logoUrl: emailConfig.brandLogoUrl,
                includePrivacyConsent: !existingUser,
                privacyPolicyUrl: PRIVACY_POLICY_URL,
                translations: {
                  preview: msg.preview,
                  title: msg.title,
                  greeting: msg.greeting,
                  message: msg.message,
                  consentBefore: msg.consentBefore,
                  consentPrivacyLabel: msg.consentPrivacyLabel,
                  consentAfter: msg.consentAfter,
                  button: msg.button,
                  codeLabel: msg.codeLabel,
                  codeExpiry: msg.codeExpiry,
                  codeHelp: msg.codeHelp,
                  footer: msg.footer,
                },
              });

          await postmarkClient.sendEmail({
            From: getPostmarkFromHeader(
              isOidcMagicLink ? "agentMessenger" : "magicLink",
            ),
            To: email,
            Tag: "magic-link",
            Subject: msg.preview,
            HtmlBody: htmlBody,
            MessageStream: "outbound",
          });
        } catch (err) {
          console.error("[Postmark] Magic link email failed:", err);
          if (process.env.NODE_ENV === "development") {
            console.log("[DEV] Magic link (Postmark failed):", url);
          }
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Failed to send magic link. Please try again.",
          });
        }
      },
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
      organizationCreation: {
        afterCreate: async ({ organization: _organization }) => {
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
      async sendInvitationEmail(data) {
        const inviteLink = `${authEnvConfig.baseUrl}/accept-invitation/${data.id}`;

        if (!postmarkClient) {
          if (process.env.NODE_ENV === "development") {
            console.log("\n[DEV] Invitation email (Postmark not configured)");
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log(`To: ${data.email}`);
            console.log(`Organization: ${data.organization.name}`);
            console.log(`Invite Link: ${inviteLink}`);
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log(
              "Tip: Set POSTMARK_SERVER_ID in your .env to send real emails\n",
            );
            return;
          }
          console.error("Postmark not configured. Invitation email failed.", {
            to: data.email,
            organizationId: data.organization.id,
          });
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Failed to send invitation email. Please try again.",
          });
        }

        const headersList = await headers();
        const locale = parseAcceptLanguage(headersList.get("accept-language"));
        const msg = getEmailMessages(locale).Invitation;
        const orgName = data.organization.name;
        const replaceOrganization = (template: string): string =>
          template.replace("{organization}", () => orgName);

        const roleName =
          data.role === "admin"
            ? "Admin"
            : data.role === "owner"
              ? "Owner"
              : "Member";

        await postmarkClient.sendEmail({
          From: getPostmarkFromHeader("invitation"),
          To: data.email,
          Tag: "organization-invitation",
          Subject: replaceOrganization(msg.preview),
          HtmlBody: await reactInvitationEmail({
            inviteLink,
            organizationName: orgName,
            inviterName: data.inviter.user.name || data.inviter.user.email,
            role: roleName,
            logoUrl: emailConfig.brandLogoUrl,
            translations: {
              preview: replaceOrganization(msg.preview),
              title: replaceOrganization(msg.title),
              greeting: msg.greeting,
              message: msg.message,
              button: msg.button,
              footer: msg.footer,
            },
          }),
          MessageStream: "outbound",
        });
      },
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
