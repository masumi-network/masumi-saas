import "server-only";

import prisma from "@masumi/database/client";
import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, apiKey, organization, twoFactor } from "better-auth/plugins";
import { localization } from "better-auth-localization";
import { headers } from "next/headers";

import { getBootstrapAdminIds } from "@/lib/auth/config";
import { authConfig, authEnvConfig } from "@/lib/config/auth.config";
import { emailConfig } from "@/lib/config/email.config";
import { reactInvitationEmail } from "@/lib/email/invitation";
import { getEmailMessages, parseAcceptLanguage } from "@/lib/email/messages";
import { postmarkClient } from "@/lib/email/postmark";
import { reactResetPasswordEmail } from "@/lib/email/reset-password";
import { reactVerificationEmail } from "@/lib/email/verification";

export const auth = betterAuth({
  appName: "Masumi",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: authEnvConfig.secret,
  baseURL: authEnvConfig.baseUrl,
  trustedOrigins: [
    authEnvConfig.baseUrl,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://appleid.apple.com",
  ],
  emailAndPassword: {
    enabled: true,
    // Allow unverified users to sign in; we enforce verification at the action level instead
    requireEmailVerification: false,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      const headersList = await headers();
      const locale = parseAcceptLanguage(headersList.get("accept-language"));
      const msg = getEmailMessages(locale);

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
            {
              to: user.email,
              resetLink: url,
            },
          );
        }
        return;
      }

      await postmarkClient.sendEmail({
        From: emailConfig.postmarkFromEmail,
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
            linkText: msg.ResetPassword.linkText,
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

      if (!postmarkClient) {
        if (process.env.NODE_ENV === "development") {
          console.log("\n[DEV] Email verification (Postmark not configured)");
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.log(`To: ${user.email}`);
          console.log(`Verification Link: ${url}`);
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.log(
            "Tip: Set POSTMARK_SERVER_ID in your .env to send real emails\n",
          );
        } else {
          console.error("Postmark not configured. Email verification failed.", {
            to: user.email,
            verificationLink: url,
          });
        }
        if (isResend) {
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Failed to send verification email. Please try again.",
          });
        }
        return;
      }

      const headersList = await headers();
      const locale = parseAcceptLanguage(headersList.get("accept-language"));
      const msg = getEmailMessages(locale).Verification;

      try {
        await postmarkClient.sendEmail({
          From: emailConfig.postmarkFromEmail,
          To: user.email,
          Tag: "verification-email",
          Subject: msg.preview,
          HtmlBody: await reactVerificationEmail({
            name: user.name || "User",
            verificationLink: url,
            logoUrl:
              "https://avatars.githubusercontent.com/u/194367856?s=200&v=4",
            translations: {
              preview: msg.preview,
              title: msg.title,
              greeting: msg.greeting,
              message: msg.message,
              button: msg.button,
              linkText: msg.linkText,
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
  plugins: [
    twoFactor({
      issuer: "Masumi",
      skipVerificationOnEnable: false,
    }),
    admin({
      defaultRole: "user",
      adminUserIds: getBootstrapAdminIds(),
    }),
    apiKey({
      defaultPrefix: "mas_",
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
        const auth = headers.get("authorization");
        if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
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
          } else {
            console.error("Postmark not configured. Invitation email failed.", {
              to: data.email,
              inviteLink,
            });
          }
          return;
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
          From: emailConfig.postmarkFromEmail,
          To: data.email,
          Tag: "organization-invitation",
          Subject: replaceOrganization(msg.preview),
          HtmlBody: await reactInvitationEmail({
            inviteLink,
            organizationName: orgName,
            inviterName: data.inviter.user.name || data.inviter.user.email,
            role: roleName,
            logoUrl:
              "https://avatars.githubusercontent.com/u/194367856?s=200&v=4",
            translations: {
              preview: replaceOrganization(msg.preview),
              title: replaceOrganization(msg.title),
              greeting: msg.greeting,
              message: msg.message,
              button: msg.button,
              linkText: msg.linkText,
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
