import "server-only";

import prisma from "@masumi/database/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { apiKey, organization } from "better-auth/plugins";
import { localization } from "better-auth-localization";

import { authConfig } from "@/lib/config/auth.config";
import { postmarkClient } from "@/lib/email/postmark";
import { reactResetPasswordEmail } from "@/lib/email/reset-password";
import { reactVerificationEmail } from "@/lib/email/verification";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      if (!postmarkClient) {
        console.log("Password reset email (Postmark not configured):", {
          to: user.email,
          resetLink: url,
        });
        return;
      }

      const fromEmail =
        process.env.POSTMARK_FROM_EMAIL || "noreply@masumi.network";

      await postmarkClient.sendEmail({
        From: fromEmail,
        To: user.email,
        Tag: "reset-password",
        Subject: "Reset your Masumi password",
        HtmlBody: await reactResetPasswordEmail({
          name: user.name || "User",
          resetLink: url,
        }),
        MessageStream: "outbound",
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      if (!postmarkClient) {
        console.log("Verification email (Postmark not configured):", {
          to: user.email,
          verificationLink: url,
        });
        return;
      }

      const fromEmail =
        process.env.POSTMARK_FROM_EMAIL || "noreply@masumi.network";

      await postmarkClient.sendEmail({
        From: fromEmail,
        To: user.email,
        Tag: "verification-email",
        Subject: "Verify your Masumi email address",
        HtmlBody: await reactVerificationEmail({
          name: user.name || "User",
          verificationLink: url,
        }),
        MessageStream: "outbound",
      });
    },
    sendOnSignUp: true,
    sendOnSignIn: true,
    expiresIn: authConfig.emailVerification.expiresIn,
    autoSignInAfterVerification: true,
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
        const inviteLink = `${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/accept-invitation/${data.id}`;
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
