"use client";

import {
  adminClient,
  apiKeyClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    apiKeyClient(),
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
  useSession,
  changeEmail,
  twoFactor,
} = authClient;
