import "server-only";

import prisma from "@masumi/database/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { apiKey, organization } from "better-auth/plugins";
import { localization } from "better-auth-localization";

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
  },
  plugins: [
    apiKey({
      rateLimit: {
        enabled: true,
        timeWindow: 60, // 60 seconds
        maxRequests: 100, // 100 requests per minute
      },
      enableMetadata: true,
    }),
    organization({
      organizationCreation: {
        afterCreate: async ({ organization }) => {
          // Add any post-creation logic here
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
      invitationLimit: 100,
      cancelPendingInvitationsOnReInvite: true,
      allowUserToCreateOrganization(user) {
        return user.emailVerified;
      },
      organizationLimit: 10,
      invitationExpiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
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

