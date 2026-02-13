import "server-only";

import prisma from "@masumi/database/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { apiKey, organization } from "better-auth/plugins";
import { localization } from "better-auth-localization";
import { getTranslations } from "next-intl/server";

import { authConfig, authEnvConfig } from "@/lib/config/auth.config";
import { emailConfig } from "@/lib/config/email.config";
import { postmarkClient } from "@/lib/email/postmark";
import { reactResetPasswordEmail } from "@/lib/email/reset-password";
import { reactVerificationEmail } from "@/lib/email/verification";

export const auth = betterAuth({
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
            {
              to: user.email,
              resetLink: url,
            },
          );
        }
        return;
      }

      const t = await getTranslations({
        locale: "en",
        namespace: "Email.ResetPassword",
      });

      await postmarkClient.sendEmail({
        From: emailConfig.postmarkFromEmail,
        To: user.email,
        Tag: "reset-password",
        Subject: t("preview"),
        HtmlBody: await reactResetPasswordEmail({
          name: user.name || "User",
          resetLink: url,
          translations: {
            preview: t("preview"),
            title: t("title"),
            greeting: t("greeting"),
            message: t("message"),
            button: t("button"),
            linkText: t("linkText"),
            footer: t("footer"),
          },
        }),
        MessageStream: "outbound",
      });
    },
  },
  socialProviders: authEnvConfig.socialProviders,
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
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
        return;
      }

      const t = await getTranslations({
        locale: "en",
        namespace: "Email.Verification",
      });

      await postmarkClient.sendEmail({
        From: emailConfig.postmarkFromEmail,
        To: user.email,
        Tag: "verification-email",
        Subject: t("preview"),
        HtmlBody: await reactVerificationEmail({
          name: user.name || "User",
          verificationLink: url,
          translations: {
            preview: t("preview"),
            title: t("title"),
            greeting: t("greeting"),
            message: t("message"),
            button: t("button"),
            linkText: t("linkText"),
            footer: t("footer"),
          },
        }),
        MessageStream: "outbound",
      });
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
    apiKey({
      rateLimit: authConfig.apiKey.rateLimit,
      enableMetadata: authConfig.apiKey.enableMetadata,
    }),
    organization({
      organizationCreation: {
        afterCreate: async ({ organization }) => {
          // post-creation logic here
          console.log("Organization created:", organization.id);
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
        // TODO: Implement email sending
        console.log("Invitation email:", {
          to: data.email,
          organization: data.organization.name,
          link: inviteLink,
        });
      },
      invitationLimit: authConfig.organization.invitationLimit,
      cancelPendingInvitationsOnReInvite:
        authConfig.organization.cancelPendingInvitationsOnReInvite,
      allowUserToCreateOrganization(user) {
        return user.emailVerified;
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
