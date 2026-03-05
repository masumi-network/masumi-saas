import "server-only";

import prisma from "@masumi/database/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, apiKey, organization, twoFactor } from "better-auth/plugins";
import { localization } from "better-auth-localization";

import { getBootstrapAdminIds } from "@/lib/auth/config";
import { authConfig, authEnvConfig } from "@/lib/config/auth.config";
import { emailConfig } from "@/lib/config/email.config";
import { reactInvitationEmail } from "@/lib/email/invitation";
import { emailMessagesEn } from "@/lib/email/messages";
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
    requireEmailVerification:
      authConfig.emailAndPassword.requireEmailVerification,
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

      const msg = emailMessagesEn.ResetPassword;

      await postmarkClient.sendEmail({
        From: emailConfig.postmarkFromEmail,
        To: user.email,
        Tag: "reset-password",
        Subject: msg.preview,
        HtmlBody: await reactResetPasswordEmail({
          name: user.name || "User",
          resetLink: url,
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

      const msg = emailMessagesEn.Verification;

      await postmarkClient.sendEmail({
        From: emailConfig.postmarkFromEmail,
        To: user.email,
        Tag: "verification-email",
        Subject: msg.preview,
        HtmlBody: await reactVerificationEmail({
          name: user.name || "User",
          verificationLink: url,
          // TODO: use base path or prod URL: `${authEnvConfig.baseUrl}/assets/logo.png`; gstatic fallback for now
          logoUrl:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRIHllGpdTbbAPSKNCE8dXY3xfS54MLmKYKGA&s",
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
      rateLimit: authConfig.apiKey.rateLimit,
      enableMetadata: authConfig.apiKey.enableMetadata,
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

        const msg = emailMessagesEn.Invitation;
        const orgName = data.organization.name;

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
          Subject: msg.preview.replace("{organization}", orgName),
          HtmlBody: await reactInvitationEmail({
            inviteLink,
            organizationName: orgName,
            inviterName: data.inviter.user.name || data.inviter.user.email,
            role: roleName,
            logoUrl:
              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRIHllGpdTbbAPSKNCE8dXY3xfS54MLmKYKGA&s",
            translations: {
              preview: msg.preview.replace("{organization}", orgName),
              title: msg.title.replace("{organization}", orgName),
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
