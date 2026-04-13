"use client";

import {
  adminClient,
  apiKeyClient,
  emailOTPClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    apiKeyClient(),
    emailOTPClient(),
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/2fa";
      },
    }),
  ],
});

export const {
  signUp,
  signIn,
  signOut,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  sendVerificationEmail,
  useSession,
  changeEmail,
  twoFactor,
} = authClient;

export const emailOtp = authClient.emailOtp;
